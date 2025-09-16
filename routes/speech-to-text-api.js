const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// Supported audio MIME types (matching OpenAI Whisper API requirements)
const allowedMimes = [
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/mp4', 
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
    'audio/mp3',
    'audio/ogg',
    'audio/ogg;codecs=opus'
];

// File size limit (25MB - OpenAI's limit)
const MAX_FILE_SIZE = 25 * 1024 * 1024;

async function routes(fastify, options) {
    // Initialize OpenAI client
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });

    /**
     * POST /api/speech-to-text
     * Convert speech to text using OpenAI Whisper API
     */
    fastify.post('/api/speech-to-text', {
        preHandler: async (request, reply) => {
            // Ensure multipart handling is enabled for this route
            if (!request.isMultipart()) {
                return reply.status(400).send({
                    success: false,
                    error: 'Request must be multipart/form-data'
                });
            }
        }
    }, async (request, reply) => {
        const isLocalMode = process.env.MODE === 'local';
        
        if (isLocalMode) {
            console.log('[Speech-to-Text] Request received:', {
                headers: Object.keys(request.headers),
                contentType: request.headers['content-type'],
                userAgent: request.headers['user-agent']
            });
        }
        
        try {
            // Handle multipart form data
            const data = await request.file();
            
            if (isLocalMode) {
                console.log('[Speech-to-Text] File data received:', {
                    hasData: !!data,
                    mimetype: data?.mimetype,
                    filename: data?.filename,
                    encoding: data?.encoding
                });
            }
            
            if (!data) {
                if (isLocalMode) {
                    console.error('[Speech-to-Text] No file data in request');
                }
                return reply.status(400).send({
                    success: false,
                    error: 'No audio file provided'
                });
            }

            // Validate file type
            if (!allowedMimes.includes(data.mimetype)) {
                if (isLocalMode) {
                    console.error('[Speech-to-Text] Invalid file type:', {
                        received: data.mimetype,
                        allowed: allowedMimes
                    });
                }
                return reply.status(400).send({
                    success: false,
                    error: 'Invalid file type. Only audio files are allowed.'
                });
            }

            // Check file size
            const buffer = await data.toBuffer();
            if (buffer.length > MAX_FILE_SIZE) {
                if (isLocalMode) {
                    console.error('[Speech-to-Text] File too large:', {
                        size: buffer.length,
                        maxSize: MAX_FILE_SIZE,
                        sizeInMB: (buffer.length / 1024 / 1024).toFixed(2)
                    });
                }
                return reply.status(413).send({
                    success: false,
                    error: 'Audio file is too large. Maximum size is 25MB.'
                });
            }
            
            // Additional validation: check if buffer is empty
            if (buffer.length === 0) {
                if (isLocalMode) {
                    console.error('[Speech-to-Text] Empty audio file');
                }
                return reply.status(400).send({
                    success: false,
                    error: 'Audio file is empty'
                });
            }

            // Get language preference from fields (always auto)
            const fields = data.fields;
            
            // Determine file extension based on mimetype
            let fileExtension = '.webm';
            switch (data.mimetype) {
                case 'audio/mp4':
                    fileExtension = '.m4a';
                    break;
                case 'audio/mpeg':
                case 'audio/mp3':
                    fileExtension = '.mp3';
                    break;
                case 'audio/wav':
                case 'audio/x-wav':
                    fileExtension = '.wav';
                    break;
                case 'audio/ogg':
                    fileExtension = '.ogg';
                    break;
                default:
                    fileExtension = '.webm';
            }
            
            if (isLocalMode) {
                console.log('[Speech-to-Text] Processing audio:', {
                    fileSize: buffer.length,
                    fileSizeMB: (buffer.length / 1024 / 1024).toFixed(2),
                    mimetype: data.mimetype,
                    fileExtension: fileExtension,
                    hasFields: !!fields
                });
            }

            // Create temporary file for OpenAI API
            const tempDir = require('os').tmpdir();
            const tempFileName = `audio_${Date.now()}${fileExtension}`;
            const tempFilePath = path.join(tempDir, tempFileName);

            // Write buffer to temporary file
            fs.writeFileSync(tempFilePath, buffer);
            
            if (isLocalMode) {
                console.log('[Speech-to-Text] Temporary file created:', {
                    path: tempFilePath,
                    fileExtension: fileExtension
                });
            }

            try {
                // Use OpenAI SDK for transcription
                const transcription = await openai.audio.transcriptions.create({
                    file: fs.createReadStream(tempFilePath),
                    model: "whisper-1"
                });

                if (isLocalMode) {
                    console.log('[Speech-to-Text] OpenAI response:', {
                        hasText: !!transcription.text,
                        textLength: transcription.text?.length
                    });
                }
                
                // Validate response
                if (!transcription.text) {
                    if (isLocalMode) {
                        console.error('[Speech-to-Text] No text in transcription response:', transcription);
                    }
                    throw new Error('No transcription text received from OpenAI');
                }

                // Log successful transcription (for debugging)
                if (isLocalMode) {
                    console.log('[Speech-to-Text] Transcription successful:', {
                        userId: request.user?._id,
                        textLength: transcription.text.length,
                        fileSize: buffer.length,
                        mimetype: data.mimetype,
                        text: transcription.text.substring(0, 100) + (transcription.text.length > 100 ? '...' : '')
                    });
                } else {
                    fastify.log.info('Speech-to-text successful:', {
                        userId: request.user?._id,
                        textLength: transcription.text.length,
                        fileSize: buffer.length,
                        mimetype: data.mimetype
                    });
                }

                // Return successful response
                return reply.send({
                    success: true,
                    text: transcription.text.trim(),
                    language: 'auto',
                    duration: null
                });

            } catch (openaiError) {
                if (isLocalMode) {
                    console.error('[Speech-to-Text] OpenAI API error:', openaiError);
                }
                throw new Error(`OpenAI API error: ${openaiError.message}`);
            } finally {
                // Clean up temporary file
                try {
                    fs.unlinkSync(tempFilePath);
                    if (isLocalMode) {
                        console.log('[Speech-to-Text] Temporary file cleaned up:', tempFilePath);
                    }
                } catch (cleanupError) {
                    if (isLocalMode) {
                        console.warn('[Speech-to-Text] Failed to cleanup temporary file:', cleanupError);
                    }
                }
            }

        } catch (error) {
            if (isLocalMode) {
                console.error('[Speech-to-Text] Error details:', {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                });
            }
            
            fastify.log.error('Speech-to-text error:', error);
            
            // Determine error type and provide appropriate response
            let statusCode = 500;
            let errorMessage = 'Internal server error during speech recognition';
            
            if (error.message.includes('OpenAI API error')) {
                statusCode = 502;
                errorMessage = 'External speech recognition service error';
            } else if (error.message.includes('Invalid file type')) {
                statusCode = 400;
                errorMessage = 'Invalid audio file format';
            } else if (error.message.includes('File too large')) {
                statusCode = 413;
                errorMessage = 'Audio file is too large';
            } else if (error.message.includes('No audio file')) {
                statusCode = 400;
                errorMessage = 'No audio file provided';
            }

            return reply.status(statusCode).send({
                success: false,
                error: errorMessage,
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    });

    /**
     * GET /api/speech-to-text/languages
     * Get supported languages for speech recognition
     */
    fastify.get('/api/speech-to-text/languages', {
        schema: {
            description: 'Get supported languages for speech recognition',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        languages: { type: 'object' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const supportedLanguages = {
            'auto': { name: 'Auto Detect', code: 'auto' },
            'en': { name: 'English', code: 'en' },
            'ja': { name: '日本語', code: 'ja' },
            'ko': { name: '한국어', code: 'ko' },
            'zh': { name: '中文', code: 'zh' },
            'fr': { name: 'Français', code: 'fr' },
            'de': { name: 'Deutsch', code: 'de' },
            'es': { name: 'Español', code: 'es' },
            'it': { name: 'Italiano', code: 'it' },
            'pt': { name: 'Português', code: 'pt' },
            'ru': { name: 'Русский', code: 'ru' },
            'ar': { name: 'العربية', code: 'ar' },
            'hi': { name: 'हिन्दी', code: 'hi' },
            'th': { name: 'ไทย', code: 'th' },
            'vi': { name: 'Tiếng Việt', code: 'vi' }
        };
        
        return reply.send({
            success: true,
            languages: supportedLanguages
        });
    });

    /**
     * GET /api/speech-to-text/status
     * Check if speech-to-text service is available
     */
    fastify.get('/api/speech-to-text/status', {
        schema: {
            description: 'Check if speech-to-text service is available',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        available: { type: 'boolean' },
                        service: { type: 'string' },
                        maxFileSize: { type: 'string' },
                        supportedFormats: { type: 'array', items: { type: 'string' } }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const hasApiKey = !!process.env.OPENAI_API_KEY;
        
        return reply.send({
            success: true,
            available: hasApiKey,
            service: 'OpenAI Whisper',
            maxFileSize: '25MB',
            supportedFormats: ['webm', 'mp4', 'mp3', 'wav', 'ogg']
        });
    });
}

module.exports = routes;
