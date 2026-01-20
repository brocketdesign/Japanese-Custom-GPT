/**
 * API Keys Management Routes
 * Allows users to create and manage their API keys for external integrations
 */

const { ObjectId } = require('mongodb');
const crypto = require('crypto');

/**
 * Generate a secure API key
 */
function generateApiKey() {
    // Generate a random 32-byte key and encode as base64
    const key = crypto.randomBytes(32).toString('base64url');
    return `clx_${key}`;
}

/**
 * Hash an API key for storage
 */
function hashApiKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

async function routes(fastify, options) {
    const db = fastify.mongo.db;

    /**
     * GET /api/user/api-keys
     * List user's API keys (without showing the full key)
     */
    fastify.get('/api/user/api-keys', async (request, reply) => {
        try {
            const user = request.user;
            if (!user) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }

            const apiKeysCollection = db.collection('apiKeys');
            const keys = await apiKeysCollection.find({
                userId: new ObjectId(user._id)
            }).sort({ createdAt: -1 }).toArray();

            // Return keys without the actual key value (only show prefix)
            const safeKeys = keys.map(key => ({
                _id: key._id,
                name: key.name,
                keyPreview: key.keyPreview || 'clx_****',
                active: key.active,
                createdAt: key.createdAt,
                lastUsedAt: key.lastUsedAt,
                usageCount: key.usageCount || 0
            }));

            return reply.send({
                success: true,
                keys: safeKeys
            });

        } catch (error) {
            console.error('[API Keys] Error listing keys:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * POST /api/user/api-keys
     * Create a new API key
     */
    fastify.post('/api/user/api-keys', async (request, reply) => {
        try {
            const user = request.user;
            if (!user) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }

            const { name } = request.body;
            const keyName = name || `API Key ${new Date().toLocaleDateString()}`;

            // Check if user already has max number of keys (limit to 5)
            const apiKeysCollection = db.collection('apiKeys');
            const existingKeysCount = await apiKeysCollection.countDocuments({
                userId: new ObjectId(user._id),
                active: true
            });

            if (existingKeysCount >= 5) {
                return reply.status(400).send({
                    error: 'Maximum number of API keys reached (5). Please delete an existing key first.'
                });
            }

            // Generate new API key
            const apiKey = generateApiKey();
            const keyHash = hashApiKey(apiKey);
            const keyPreview = `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`;

            const keyDocument = {
                userId: new ObjectId(user._id),
                name: keyName,
                key: keyHash, // Store hashed version
                keyPreview: keyPreview,
                active: true,
                createdAt: new Date(),
                lastUsedAt: null,
                usageCount: 0
            };

            const result = await apiKeysCollection.insertOne(keyDocument);

            console.log(`[API Keys] New API key created for user ${user._id}`);

            // Return the full key ONLY this once
            return reply.send({
                success: true,
                key: {
                    _id: result.insertedId,
                    name: keyName,
                    apiKey: apiKey, // Full key - shown only once!
                    keyPreview: keyPreview,
                    createdAt: keyDocument.createdAt
                },
                message: 'API key created successfully. Save this key now - it will not be shown again!'
            });

        } catch (error) {
            console.error('[API Keys] Error creating key:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * DELETE /api/user/api-keys/:keyId
     * Delete/revoke an API key
     */
    fastify.delete('/api/user/api-keys/:keyId', async (request, reply) => {
        try {
            const user = request.user;
            if (!user) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }

            const { keyId } = request.params;

            if (!ObjectId.isValid(keyId)) {
                return reply.status(400).send({ error: 'Invalid key ID' });
            }

            const apiKeysCollection = db.collection('apiKeys');
            
            // Verify the key belongs to this user before deleting
            const result = await apiKeysCollection.deleteOne({
                _id: new ObjectId(keyId),
                userId: new ObjectId(user._id)
            });

            if (result.deletedCount === 0) {
                return reply.status(404).send({ error: 'API key not found' });
            }

            console.log(`[API Keys] API key ${keyId} deleted for user ${user._id}`);

            return reply.send({
                success: true,
                message: 'API key deleted successfully'
            });

        } catch (error) {
            console.error('[API Keys] Error deleting key:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * PATCH /api/user/api-keys/:keyId
     * Update API key (rename or toggle active status)
     */
    fastify.patch('/api/user/api-keys/:keyId', async (request, reply) => {
        try {
            const user = request.user;
            if (!user) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }

            const { keyId } = request.params;
            const { name, active } = request.body;

            if (!ObjectId.isValid(keyId)) {
                return reply.status(400).send({ error: 'Invalid key ID' });
            }

            const updateData = {};
            if (name !== undefined) updateData.name = name;
            if (active !== undefined) updateData.active = active;

            if (Object.keys(updateData).length === 0) {
                return reply.status(400).send({ error: 'No update data provided' });
            }

            const apiKeysCollection = db.collection('apiKeys');
            
            const result = await apiKeysCollection.updateOne(
                {
                    _id: new ObjectId(keyId),
                    userId: new ObjectId(user._id)
                },
                { $set: updateData }
            );

            if (result.matchedCount === 0) {
                return reply.status(404).send({ error: 'API key not found' });
            }

            return reply.send({
                success: true,
                message: 'API key updated successfully'
            });

        } catch (error) {
            console.error('[API Keys] Error updating key:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * GET /api/docs
     * Serve API documentation page
     */
    fastify.get('/api/docs', async (request, reply) => {
        const user = request.user;
        const translations = request.translations;

        return reply.view('api-docs', {
            title: 'API Documentation',
            user,
            translations,
            pageType: 'docs'
        });
    });

    /**
     * Middleware to validate API key for external API routes
     * This is used by dashboard-integration-api.js
     */
    fastify.decorate('validateApiKey', async (apiKey) => {
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
    });
}

// Export hash function for use in other modules
module.exports = routes;
module.exports.hashApiKey = hashApiKey;
