const { ObjectId } = require('mongodb');
const DEFAULT_CHAT_SETTINGS = require('../config/default-chat-settings.json');

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
            console.warn('[getUserChatToolSettings] Invalid userId provided:', userId);
            return DEFAULT_CHAT_SETTINGS;
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
                return { ...DEFAULT_CHAT_SETTINGS, ...settings };
            }
        }
        
        // Fallback to user default settings
        const userSettings = await collection.findOne({ 
            userId: new ObjectId(userId),
            chatId: { $exists: false }
        });

        if (userSettings) {
            const { _id, userId: userIdField, createdAt, updatedAt, ...settings } = userSettings;
            return { ...DEFAULT_CHAT_SETTINGS, ...settings };
        }
        
        return DEFAULT_CHAT_SETTINGS;
        
    } catch (error) {
        console.error('[getUserChatToolSettings] Error fetching settings:', error);
        return DEFAULT_CHAT_SETTINGS;
    }
}

/**
 * Apply user settings and character data to system prompt generation
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {string} chatId - Optional chat ID
 * @param {string} basePrompt - Base system prompt
 * @param {Object} chatDocument - Chat document containing character data
 * @returns {string} Enhanced system prompt with user preferences and character context
 */
async function applyUserSettingsToPrompt(db, userId, chatId, basePrompt, chatDocument = null) {
    try {
        let enhancedPrompt = basePrompt;
        
        // Get character gender and relationship from chat document
        const characterGender = chatDocument?.gender || 'female';
        const relationshipType = chatDocument?.relationship || 'companion';
        
        // Apply relationship type from character creation - handle both new gender-based and legacy formats
        const { relationshipInstructions } = require('./relashionshipInstructions');
        const genderKey = characterGender?.toLowerCase() === 'male' ? 'male' : 'female';
        
        if (relationshipInstructions[genderKey] && relationshipInstructions[genderKey][relationshipType]) {
            enhancedPrompt += `\n# Relationship Context:\n${relationshipInstructions[genderKey][relationshipType]}`;
        } else if (relationshipInstructions[genderKey] && relationshipInstructions[genderKey].companion) {
            enhancedPrompt += `\n# Relationship Context:\n${relationshipInstructions[genderKey].companion}`;
        }
        
        // Add instructions for NSFW relationships if applicable
        const nsfw_relationships = ['lover', 'submissive', 'dominant', 'playmate', 'intimate'];
        if (nsfw_relationships.includes(relationshipType)) {
            enhancedPrompt += `\n# NSFW Relationship Context:\nYou are in a ${relationshipType} relationship. Use explicit, sensual language and describe intimate acts in detail.`;
        }
        
        // Add character personality context from character creation
        if (chatDocument) {
            let characterContext = '\n# Character Context:';
            
            if (chatDocument.characterPersonality) {
                characterContext += `\nPersonality: You have a ${chatDocument.characterPersonality} personality. Embody this trait in your responses.`;
            }
            
            if (chatDocument.characterOccupation) {
                characterContext += `\nOccupation: You work as a ${chatDocument.characterOccupation}. Reference this naturally in conversations when relevant.`;
            }
            
            if (chatDocument.characterPreferences) {
                characterContext += `\nPreferences: You are into ${chatDocument.characterPreferences}. Express this naturally when the conversation leads there.`;
            }
            
            if (chatDocument.chatPurpose) {
                characterContext += `\nSpecial Instructions: ${chatDocument.chatPurpose}`;
            }
            
            // Only add character context section if we have any character data
            if (characterContext !== '\n# Character Context:') {
                enhancedPrompt += characterContext;
            }
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
        
        // Return user-specific video prompt or default if not set
        return settings.videoPrompt || DEFAULT_CHAT_SETTINGS.videoPrompt;
        
    } catch (error) {
        console.error('[getUserVideoPrompt] Error getting video prompt:', error);
        return DEFAULT_CHAT_SETTINGS.videoPrompt;
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
        
        const voiceProviderRaw = settings.voiceProvider || 'standard';
        const normalizedProvider = String(voiceProviderRaw).toLowerCase();

        if (normalizedProvider === 'premium' || normalizedProvider === 'minimax' || normalizedProvider === 'evenlab') {
            const minimaxVoice = settings.minimaxVoice || settings.evenLabVoice || DEFAULT_CHAT_SETTINGS.minimaxVoice;
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
        return settings.minImages || DEFAULT_CHAT_SETTINGS.minImages;
    } catch (error) {
        console.error('[getUserMinImages] Error getting minimum images:', error);
        return DEFAULT_CHAT_SETTINGS.minImages;
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
        return settings.autoMergeFace !== undefined ? settings.autoMergeFace : DEFAULT_CHAT_SETTINGS.autoMergeFace;
    } catch (error) {
        console.error('[getAutoMergeFaceSetting] Error getting auto merge face setting:', error);
        return DEFAULT_CHAT_SETTINGS.autoMergeFace;
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
        let selectedModel = settings.selectedModel;
        
        // If no model selected, try to get a default from available models
        if (!selectedModel) {
            try {
                const { getAvailableModelsFormatted } = require('./chat-model-utils');
                const dbModels = await getAvailableModelsFormatted();
                
                if (dbModels && Object.keys(dbModels).length > 0) {
                    // Get first available free model as default
                    const freeModels = Object.entries(dbModels).filter(([key, model]) => model.category !== 'premium');
                    if (freeModels.length > 0) {
                        selectedModel = freeModels[0][0];
                    }
                }
            } catch (dbError) {
                console.log('[getUserSelectedModel] Database not available, using legacy default');
            }
            
            // Final fallback to legacy default
            selectedModel = selectedModel || 'openai';
        }
        
        return selectedModel;
    } catch (error) {
        console.error('[getUserSelectedModel] Error getting selected model:', error);
        return 'openai'; // Changed default to openai as it's more commonly available
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
        return settings.autoImageGeneration !== undefined ? settings.autoImageGeneration : DEFAULT_CHAT_SETTINGS.autoImageGeneration;
    } catch (error) {
        console.error('[getAutoImageGenerationSetting] Error getting auto image generation setting:', error);
        return DEFAULT_CHAT_SETTINGS.autoImageGeneration;
    }
}

/**
 * Check if user has ever chatted with a specific character
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {string} chatId - Chat ID (character ID)
 * @returns {boolean} True if user has chatted with this character (has messages), false otherwise
 */
async function hasUserChattedWithCharacter(db, userId, chatId) {
    try {
        if (!userId || !ObjectId.isValid(userId) || !chatId || !ObjectId.isValid(chatId)) {
            return false;
        }

        const userChatCollection = db.collection('userChat');
        
        // Convert to ObjectId for proper query
        const userIdObj = new ObjectId(userId);
        const chatIdObj = new ObjectId(chatId);
        
        // Query using both ObjectId and string formats (like gallery.js)
        const query = {
            $or: [
                { userId: userIdObj, chatId: chatIdObj },
                { userId: userIdObj, chatId: chatId.toString() },
                { userId: userId.toString(), chatId: chatIdObj }
            ]
        };
        
        const userChat = await userChatCollection.findOne(query);
        
        if (userChat) {
            // Check if userChat has actual messages
            const messageCount = userChat.messages ? userChat.messages.length : 0;
            
            // Only consider it as "chatted" if there are actual messages
            if (messageCount === 0) {
                return false;
            }
        } else {
            return false;
        }
        
        return !!userChat && userChat.messages && userChat.messages.length > 0;
        
    } catch (error) {
        console.error('[hasUserChattedWithCharacter] Error:', error.message);
        return false;
    }
}

/**
 * Get available relationships for a given gender
 * @param {string} gender - 'male' or 'female'
 * @returns {Object} { free: [...], premium: [...] }
 */
function getAvailableRelationshipsByGender(gender = 'female') {
    const { relationshipInstructions, relationshipTiers } = require('./relashionshipInstructions');
    const key = gender && String(gender).toLowerCase() === 'male' ? 'male' : 'female';
    const rels = relationshipInstructions[key] || {};
    // SFW relationships (not NSFW/premium)
    const free = Object.keys(rels).filter(r => relationshipTiers.free.includes(r));
    // Premium/NSFW relationships
    const premium = Object.keys(rels).filter(r => relationshipTiers.premium.includes(r));
    return { free, premium };
}

module.exports = {
    DEFAULT_CHAT_SETTINGS,
    getUserChatToolSettings,
    applyUserSettingsToPrompt,
    getUserVideoPrompt,
    getVoiceSettings,
    getUserMinImages,
    getAutoMergeFaceSetting,
    getUserSelectedModel,
    getUserPremiumStatus,
    getAutoImageGenerationSetting,
    hasUserChattedWithCharacter,
    getAvailableRelationshipsByGender
};
