const { ObjectId } = require('mongodb');

/**
 * Default chat tool settings
 */
const DEFAULT_SETTINGS = {
    minImages: 3,
    videoPrompt: 'Generate a short, engaging video with smooth transitions and vibrant colors.',
    relationshipType: 'companion',
    selectedVoice: 'nova',
    minimaxVoice: 'Wise_Woman',
    voiceProvider: 'standard',
    autoMergeFace: true,
    autoImageGeneration: false,
    goalsEnabled: false
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
        const relationshipInstructions = require('./relashionshipInstructions');
        
        if (relationshipInstructions[settings.relationshipType]) {
            enhancedPrompt += `\n# Relationship Context :\n ${relationshipInstructions[settings.relationshipType]}`;
        }
        // Add instructions for NSFW relationships if applicabl
        if (settings.relationshipType === 'lover' || settings.relationshipType === 'submissive' || settings.relationshipType === 'dominant' || settings.relationshipType === 'playmate' || settings.relationshipType === 'intimate') {
            enhancedPrompt += `\n# NSFW Relationship Context :\n You are in a ${settings.relationshipType} relationship. Use explicit, sensual language and describe intimate acts in detail. `;
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
        
        const voiceProviderRaw = settings.voiceProvider || 'standard';
        const normalizedProvider = String(voiceProviderRaw).toLowerCase();

        if (normalizedProvider === 'premium' || normalizedProvider === 'minimax' || normalizedProvider === 'evenlab') {
            const minimaxVoice = settings.minimaxVoice || settings.evenLabVoice || DEFAULT_SETTINGS.minimaxVoice;
            return {
                provider: 'minimax',
                voice: minimaxVoice,
                voiceName: minimaxVoice
            };
        }

        const selectedVoice = settings.selectedVoice || 'nova';

        const voiceConfig = {
            alloy: { voice: 'alloy', gender: 'neutral' },
            fable: { voice: 'fable', gender: 'neutral' },
            nova: { voice: 'nova', gender: 'female' },
            shimmer: { voice: 'shimmer', gender: 'female' }
        };

        const voiceConfigEntry = voiceConfig[selectedVoice] || voiceConfig.nova;

        return {
            provider: 'openai',
            ...voiceConfigEntry
        };
        
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

/**
 * Get user's selected model setting
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {string} chatId - Optional chat ID for chat-specific settings
 * @returns {string} Selected model key
 */
async function getUserSelectedModel(db, userId, chatId = null) {
    try {
        const settings = await getUserChatToolSettings(db, userId, chatId);
        return settings.selectedModel || 'mistral'; // Default to mistral
    } catch (error) {
        console.error('[getUserSelectedModel] Error getting selected model:', error);
        return 'mistral';
    }
}

/**
 * Check if user has premium subscription
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @returns {boolean} Whether user has premium subscription
 */
async function getUserPremiumStatus(db, userId) {
    try {
        if (!userId || !ObjectId.isValid(userId)) {
            return false;
        }

        const usersCollection = db.collection('users');
        const user = await usersCollection.findOne({ 
            _id: new ObjectId(userId) 
        });
        
        return user?.subscriptionStatus === 'active';
        
    } catch (error) {
        console.error('[getUserPremiumStatus] Error checking premium status:', error);
        return false;
    }
}

/**
 * Check if auto image generation is enabled for user
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {string} chatId - Optional chat ID for chat-specific settings
 * @returns {boolean} Whether auto image generation is enabled
 */
async function getAutoImageGenerationSetting(db, userId, chatId = null) {
    try {
        const settings = await getUserChatToolSettings(db, userId, chatId);
        return settings.autoImageGeneration !== undefined ? settings.autoImageGeneration : DEFAULT_SETTINGS.autoImageGeneration;
    } catch (error) {
        console.error('[getAutoImageGenerationSetting] Error getting auto image generation setting:', error);
        return DEFAULT_SETTINGS.autoImageGeneration;
    }
}

module.exports = {
    DEFAULT_SETTINGS,
    getUserChatToolSettings,
    applyUserSettingsToPrompt,
    getUserVideoPrompt,
    getVoiceSettings,
    getUserMinImages,
    getAutoMergeFaceSetting,
    getUserSelectedModel,
    getUserPremiumStatus,
    getAutoImageGenerationSetting
};
