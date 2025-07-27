const { ObjectId } = require('mongodb');

/**
 * Default chat tool settings
 */
const DEFAULT_SETTINGS = {
    minImages: 3,
    videoPrompt: 'Generate a short, engaging video with smooth transitions and vibrant colors.',
    relationshipType: 'companion',
    selectedVoice: 'nova',
    autoMergeFace: true
};

/**
 * Get user's chat tool settings with fallback to defaults
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {string} chatId - Optional chat ID for chat-specific settings
 * @returns {Object} User settings or default settings
 */
async function getUserChatToolSettings(db, userId, chatId = null) {
    try {
        if (!userId || !ObjectId.isValid(userId)) {
            console.warn('[getUserChatToolSettings] Invalid user ID, returning defaults');
            return DEFAULT_SETTINGS;
        }

        const collection = db.collection('chatToolSettings');
        
        // If chatId is provided, try to get chat-specific settings first
        if (chatId && ObjectId.isValid(chatId)) {
            const chatSettings = await collection.findOne({ 
                userId: new ObjectId(userId),
                chatId: new ObjectId(chatId)
            });
            
            if (chatSettings) {
                const { _id, userId: userIdField, chatId: chatIdField, createdAt, updatedAt, ...settings } = chatSettings;
                return { ...DEFAULT_SETTINGS, ...settings };
            }
        }
        
        // Fallback to user default settings
        const userSettings = await collection.findOne({ 
            userId: new ObjectId(userId),
            chatId: { $exists: false }
        });
        
        if (userSettings) {
            const { _id, userId: userIdField, createdAt, updatedAt, ...settings } = userSettings;
            return { ...DEFAULT_SETTINGS, ...settings };
        }
        
        return DEFAULT_SETTINGS;
        
    } catch (error) {
        console.error('[getUserChatToolSettings] Error fetching settings:', error);
        return DEFAULT_SETTINGS;
    }
}

/**
 * Apply user settings to system prompt generation
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {string} chatId - Optional chat ID
 * @param {string} basePrompt - Base system prompt
 * @returns {string} Enhanced system prompt with user preferences
 */
async function applyUserSettingsToPrompt(db, userId, chatId, basePrompt) {
    try {
        const settings = await getUserChatToolSettings(db, userId, chatId);
        
        let enhancedPrompt = basePrompt;
        
        // Apply relationship type
        const relationshipInstructions = {
            friend: 'You are a good friend. Be loyal, caring, and supportive in your interactions.',
            companion: 'You are a close companion. Be supportive, understanding, and emotionally available.',
            mentor: 'You are a wise mentor. Be guiding, educational, and provide thoughtful advice.',
            partner: 'You are in a romantic partnership. Be loving, affectionate, and emotionally intimate.',
            assistant: 'You are a helpful assistant. Be professional, efficient, and focus on being useful.',
            // Premium NSFW relationships
            lover: 'You are a passionate lover. Be sensual, romantic, and deeply intimate in your interactions.',
            submissive: 'You are submissive and obedient. Be compliant, eager to please, and responsive to guidance.',
            dominant: 'You are dominant and assertive. Be confident, controlling, and take charge of interactions.',
            playmate: 'You are a playful and adventurous companion. Be flirtatious, fun, and open to exploration.',
            intimate: 'You are deeply intimate and connected. Be vulnerable, emotionally open, and physically affectionate.'
        };
        
        if (relationshipInstructions[settings.relationshipType]) {
            enhancedPrompt += `\n# Relationship Context :\n ${relationshipInstructions[settings.relationshipType]}`;
        }
        
        return enhancedPrompt;
        
    } catch (error) {
        console.error('[applyUserSettingsToPrompt] Error applying settings:', error);
        return basePrompt;
    }
}
//getUserVideoPrompt
/**
 * Get user-specific video prompt or default if not set
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {string} chatId - Optional chat ID
 * @returns {string} Video prompt for the user
 */
async function getUserVideoPrompt(db, userId, chatId = null) {
    try {
        const settings = await getUserChatToolSettings(db, userId, chatId);
        console.log(`[getUserVideoPrompt] User settings:`, settings);
        
        // Return user-specific video prompt or default if not set
        return settings.videoPrompt || DEFAULT_SETTINGS.videoPrompt;
        
    } catch (error) {
        console.error('[getUserVideoPrompt] Error getting video prompt:', error);
        return DEFAULT_SETTINGS.videoPrompt;
    }
}
/**
 * Get voice settings for TTS generation
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {string} chatId - Optional chat ID
 * @returns {Object} Voice configuration with provider info
 */
async function getVoiceSettings(db, userId, chatId = null) {
    try {
        const settings = await getUserChatToolSettings(db, userId, chatId);
        console.log(`[getVoiceSettings] User settings:`, settings);
        
        const voiceProvider = settings.voiceProvider || 'openai';
        
        if (voiceProvider === 'evenlab') {
            // Return EvenLab voice configuration
            const evenLabVoice = settings.evenLabVoice || 'sakura';
            return {
                provider: 'evenlab',
                voice: evenLabVoice,
                voiceName: evenLabVoice
            };
        } else {
            // Return OpenAI voice configuration
            const selectedVoice = settings.selectedVoice || 'nova';
            
            // Map voice names to TTS configurations using supported OpenAI voices
            const voiceConfig = {
                alloy: { voice: 'alloy', gender: 'neutral' },
                fable: { voice: 'fable', gender: 'neutral' },
                nova: { voice: 'nova', gender: 'female' },
                shimmer: { voice: 'shimmer', gender: 'female' }
            };
            
            const voiceConfig_ = voiceConfig[selectedVoice] || voiceConfig.default;
            
            return {
                provider: 'openai',
                ...voiceConfig_
            };
        }
        
    } catch (error) {
        console.error('[getVoiceSettings] Error getting voice settings:', error);
        return { 
            provider: 'openai',
            voice: 'nova', 
            gender: 'female' 
        };
    }
}
/*
    * Get minimum number of images setting
    * @param {Object} db - MongoDB database instance
    * @param {string} userId - User ID
    * @param {string} chatId - Optional chat ID
    * @returns {number} Minimum number of images
    */      
async function getUserMinImages(db, userId, chatId = null) {
    try {
        const settings = await getUserChatToolSettings(db, userId, chatId);
        return settings.minImages || DEFAULT_SETTINGS.minImages;
    } catch (error) {
        console.error('[getUserMinImages] Error getting minimum images:', error);
        return DEFAULT_SETTINGS.minImages;
    }
}

/**
 * Get auto merge face setting
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {string} chatId - Optional chat ID
 * @returns {boolean} Auto merge face enabled
 */
async function getAutoMergeFaceSetting(db, userId, chatId = null) {
    try {
        const settings = await getUserChatToolSettings(db, userId, chatId);
        return settings.autoMergeFace !== undefined ? settings.autoMergeFace : DEFAULT_SETTINGS.autoMergeFace;
    } catch (error) {
        console.error('[getAutoMergeFaceSetting] Error getting auto merge face setting:', error);
        return DEFAULT_SETTINGS.autoMergeFace;
    }
}

module.exports = {
    DEFAULT_SETTINGS,
    getUserChatToolSettings,
    applyUserSettingsToPrompt,
    getUserVideoPrompt,
    getVoiceSettings,
    getUserMinImages,
    getAutoMergeFaceSetting
};
