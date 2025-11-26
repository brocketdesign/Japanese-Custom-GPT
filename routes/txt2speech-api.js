const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const { generateCompletion } = require('../models/openai');
const { getVoiceSettings } = require('../models/chat-tool-settings-utils');
const { removeUserPoints } = require('../models/user-points-utils');
const { getTextToSpeechCost } = require('../config/pricing');
const {
    sanitizeMessage,
    getMinimaxVoices,
    getMinimaxVoiceConfig,
    generateMinimaxSpeech
} = require('../models/txt2speech-utils');

async function routes(fastify) {
    /**
     * Generate speech using OpenAI API
     * POST /api/txt2speech
     */
    fastify.post('/api/txt2speech', async (request, reply) => {
        try {
            const { translations } = request;
            const { message, language, chatId, userId } = request.body;

            if (!message) {
                return reply.status(400).send({
                    errno: 1,
                    message: 'Message parameter is required.'
                });
            }

            const db = fastify.mongo.db;
            const cost = getTextToSpeechCost();
            console.log(`[text_to_speech] Cost for text-to-speech generation: ${cost} points`);

            try {
                await removeUserPoints(
                    db,
                    userId,
                    cost,
                    translations.points?.deduction_reasons?.text_to_speech || 'Text-to-speech generation',
                    'text_to_speech',
                    fastify
                );
            } catch (error) {
                console.error('Error deducting points:', error);
                return reply.status(500).send({ error: 'Error deducting points for text-to-speech generation.' });
            }

            let systemTone = '';
            try {
                const systemToneMessage = [
                    {
                        role: 'system',
                        content: `You are a ${language} text-to-speech specialist. Briefly describe the tone and style you would use to speak the following message, without repeating the message itself.`
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ];
                systemTone = await generateCompletion(systemToneMessage, 100, 'openai');
            } catch (error) {
                console.log('[openAi txt2speech] generateCompletion error:', error);
            }

            const openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });

            const voiceConfig = await getVoiceSettings(db, userId, chatId);
            console.log('[openAi txt2speech] voiceConfig:', voiceConfig);

            const sanitizedMessage = sanitizeMessage(message);

            let mp3;
            try {
                mp3 = await openai.audio.speech.create({
                    model: 'gpt-4o-mini-tts',
                    voice: voiceConfig.voice || 'sage',
                    input: sanitizedMessage,
                    instructions: systemTone
                });
            } catch (error) {
                console.error('Error generating speech with OpenAI:', error);
                return reply.status(500).send({
                    errno: 4,
                    message: 'Error generating speech with OpenAI.',
                    details: error.message
                });
            }

            const buffer = Buffer.from(await mp3.arrayBuffer());
            const filename = `speech-${Date.now()}.mp3`;
            const filePath = path.join(process.cwd(), 'public', 'audio', filename);

            await fs.promises.writeFile(filePath, buffer);

            setTimeout(async () => {
                try {
                    await fs.promises.unlink(filePath);
                    console.log(`Deleted audio file: ${filename} after 30 minutes`);
                } catch (deleteError) {
                    console.error(`Failed to delete audio file ${filename}:`, deleteError);
                }
            }, 30 * 60 * 1000);

            try {
                await db.collection('audioFileCleanup').insertOne({
                    filename,
                    filePath,
                    createdAt: new Date(),
                    expiresAt: new Date(Date.now() + 30 * 60 * 1000)
                });
            } catch (dbError) {
                console.error('Error recording audio file for cleanup:', dbError);
            }

            return reply.send({
                errno: 0,
                data: {
                    audio_url: `/audio/${filename}`
                }
            });
        } catch (error) {
            console.error('Error in /api/txt2speech:', error);

            if (error.response && error.response.data) {
                return reply.status(500).send({
                    errno: 2,
                    message: 'Error generating speech from OpenAI.',
                    details: error.response.data
                });
            }

            return reply.status(500).send({
                errno: 3,
                message: 'Internal server error.',
                details: error.message
            });
        }
    });

    /**
     * Generate speech using Minimax API
     * POST /api/minimax/text-to-speech
     */
    fastify.post('/api/minimax/text-to-speech', async (request, reply) => {
        try {
            const { translations } = request;
            const { text, userId, chatId, voiceName, language, voiceSetting, audioSetting, timbreWeights, pronunciationDict } = request.body;

            if (!text) {
                return reply.status(400).send({ error: 'Text is required' });
            }

            let selectedVoice = voiceName;
            const db = fastify.mongo.db;

            if (userId) {
                const cost = 3;
                console.log(`[text_to_speech] Cost for text-to-speech generation: ${cost} points`);

                try {
                    await removeUserPoints(
                        db,
                        userId,
                        cost,
                        translations.points?.deduction_reasons?.text_to_speech || 'Text-to-speech generation',
                        'text_to_speech',
                        fastify
                    );
                } catch (error) {
                    console.error('Error deducting points:', error);
                    return reply.status(500).send({ error: 'Error deducting points for text-to-speech generation.' });
                }

                try {
                    const userVoiceSettings = await getVoiceSettings(db, userId, chatId);
                    console.log('[minimax text-to-speech] User voice settings:', userVoiceSettings);

                    if (userVoiceSettings?.provider === 'minimax') {
                        selectedVoice = userVoiceSettings.voice || userVoiceSettings.voiceName || selectedVoice;
                    } else if (userVoiceSettings?.provider && userVoiceSettings.provider !== 'openai') {
                        console.warn('[minimax text-to-speech] Unexpected provider in settings:', userVoiceSettings.provider);
                    } else if (userVoiceSettings?.provider === 'openai' && !voiceName) {
                        return reply.status(400).send({
                            error: 'User is configured for standard voice provider',
                            provider: userVoiceSettings.provider,
                            voice: userVoiceSettings.voice
                        });
                    }
                } catch (error) {
                    console.warn('[minimax text-to-speech] Could not get user voice settings:', error.message);
                }
            }

            const voiceConfig = getMinimaxVoiceConfig(selectedVoice, fastify);
            console.log('[minimax text-to-speech] Using voice:', voiceConfig.key);

            const { audioBuffer, audioFormat } = await generateMinimaxSpeech(
                text,
                voiceConfig.key,
                {
                    language,
                    stream: false,
                    output_format: 'hex',
                    voice_setting: voiceSetting,
                    audio_setting: audioSetting,
                    timbre_weights: timbreWeights,
                    pronunciation_dict: pronunciationDict
                },
                fastify
            );

            const contentType = audioFormat === 'mp3' ? 'audio/mpeg'
                : audioFormat === 'wav' ? 'audio/wav'
                : audioFormat === 'flac' ? 'audio/flac'
                : 'application/octet-stream';

            return reply
                .header('Content-Type', contentType)
                .header('Content-Length', audioBuffer.length)
                .header('Cache-Control', 'public, max-age=3600')
                .send(audioBuffer);
        } catch (error) {
            console.error('[minimax text-to-speech] Error:', error);
            return reply.status(500).send({
                error: 'Failed to generate speech',
                details: error.message
            });
        }
    });

    /**
     * Get Minimax voices with translations cached in config
     * GET /api/minimax-voices
     */
    fastify.get('/api/minimax-voices', async (request, reply) => {
        try {
            const voices = getMinimaxVoices(fastify);
            return reply.send({ success: true, voices });
        } catch (error) {
            console.error('Error fetching Minimax voices:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to fetch Minimax voices'
            });
        }
    });
}

module.exports = routes;
