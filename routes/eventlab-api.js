const { ObjectId } = require('mongodb');
const { getVoiceConfig, generateSpeech, getAvailableVoices, validateApiKey, getEvenLabVoiceConfig } = require('../models/eventlab-utils');
const { getVoiceSettings } = require('../models/chat-tool-settings-utils');

async function routes(fastify, options) {
    /**
     * Generate speech using EvenLab API
     * POST /api/eventlab/text-to-speech
     */
    fastify.post('/api/eventlab/text-to-speech', async (req, res) => {
        try {
            const { text, userId, chatId, voiceName, language } = req.body;
            
            if (!text) {
                return res.status(400).json({ error: 'Text is required' });
            }

            let selectedVoice = voiceName || 'sakura';
            
            // Get user's voice settings if userId is provided
            if (userId) {
                try {
                    const db = fastify.mongo.db;
                    const userVoiceSettings = await getVoiceSettings(db, userId, chatId);
                    console.log('[eventlab text-to-speech] User voice settings:', userVoiceSettings);
                    
                    // Check if user is using EvenLab provider
                    if (userVoiceSettings.provider === 'evenlab') {
                        selectedVoice = userVoiceSettings.voice || userVoiceSettings.voiceName || 'sakura';
                    } else {
                        // User is using OpenAI, redirect to OpenAI TTS endpoint
                        return res.status(400).json({ 
                            error: 'User is configured for OpenAI voice provider',
                            provider: 'openai',
                            voice: userVoiceSettings.voice
                        });
                    }
                } catch (error) {
                    console.warn('[eventlab text-to-speech] Could not get user voice settings:', error.message);
                    selectedVoice = voiceName || 'sakura';
                }
            }

            console.log('[eventlab text-to-speech] Using voice:', selectedVoice);

            // Generate speech using EvenLab
            const audioBuffer = await generateSpeech(text, selectedVoice, {
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                    style: 0.0,
                    use_speaker_boost: true
                }
            }, fastify);
        
            // Set appropriate headers for audio response
            res.header('Content-Type', 'audio/mpeg');
            res.header('Content-Length', audioBuffer.length);
            res.header('Cache-Control', 'public, max-age=3600');

            res.send(audioBuffer);

        } catch (error) {
            console.error('[text-to-speech] Error:', error);
            res.status(500).json({ 
                error: 'Failed to generate speech',
                details: error.message 
            });
        }
    });

    /**
     * Get available voices
     * GET /api/eventlab/voices
     */
    fastify.get('/api/eventlab/voices', async (req, res) => {
        try {
            const voices = await getAvailableVoices();
            res.json({ voices });
        } catch (error) {
            console.error('[get-voices] Error:', error);
            res.status(500).json({ 
                error: 'Failed to fetch voices',
                details: error.message 
            });
        }
    });

    /**
     * Get voice configuration
     * GET /api/eventlab/voice-config/:voiceName
     */
    fastify.get('/api/eventlab/voice-config/:voiceName', (req, res) => {
        try {
            const { voiceName } = req.params;
            const voiceConfig = getEvenLabVoiceConfig(voiceName);
            res.json(voiceConfig);
        } catch (error) {
            console.error('[voice-config] Error:', error);
            res.status(500).json({ 
                error: 'Failed to get voice configuration',
                details: error.message 
            });
        }
    });

    /**
     * Validate API key
     * GET /api/eventlab/validate
     */
    fastify.get('/api/eventlab/validate', async (req, res) => {
        try {
            const isValid = await validateApiKey();
            res.json({ valid: isValid });
        } catch (error) {
            console.error('[validate-api-key] Error:', error);
            res.status(500).json({ 
                error: 'Failed to validate API key',
                details: error.message 
            });
        }
    });

    /**
     * Get user's voice settings
     * GET /api/eventlab/user-voice-settings/:userId
     */
    fastify.get('/api/eventlab/user-voice-settings/:userId', async (req, res) => {
        try {
            const { userId } = req.params;
            const { chatId } = req.query;
            
            const db = fastify.mongo.db;
            const voiceSettings = await getVoiceSettings(db, userId, chatId);
            
            res.json(voiceSettings);
        } catch (error) {
            console.error('[user-voice-settings] Error:', error);
            res.status(500).json({ 
                error: 'Failed to get user voice settings',
                details: error.message 
            });
        }
    });

    // Get available EvenLab voices
    fastify.get('/api/evenlab-voices', async (request, reply) => {
        try {

            // Get voice configuration with translations
            const voiceConfig = getVoiceConfig(fastify);
            
            // Transform voice config to array format for frontend
            const voices = Object.entries(voiceConfig).map(([key, config]) => ({
                key: key,
                name: config.name,
                description: config.description,
                gender: config.gender,
                language: config.language,
                voice_id: config.voice_id
            }));

            reply.send({ 
                success: true, 
                voices: voices.filter(voice => voice.key !== 'default') // Exclude default entry
            });
            
        } catch (error) {
            console.error('Error fetching EvenLab voices:', error);
            reply.status(500).send({ 
                success: false, 
                error: 'Failed to fetch EvenLab voices' 
            });
        }
    });
}

module.exports = routes;

