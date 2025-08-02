const { generateCompletion } = require('./openai');
const { getLanguageName } = require('./tool');
const { getUserChatToolSettings } = require('./chat-tool-settings-utils');
const { chatDataToString, userDetailsToString } = require('./chat-completion-utils');
const { OpenAI } = require("openai");
const { z } = require("zod");
const { zodResponseFormat } = require("openai/helpers/zod");

// Define the schema for chat suggestions
const chatSuggestionsSchema = z.object({
  suggestions: z.array(z.string()).length(3)
});

/**
 * Generate chat suggestions based on current conversation context
 * @param {Object} db - MongoDB database instance
 * @param {Object} chatDocument - Chat character data
 * @param {Array} userMessages - Array of recent user/assistant messages
 * @param {Object} userInfo - User information
 * @param {string} language - User's language preference
 * @returns {Promise<Array>} Array of 3 suggestion strings
 */
async function generateChatSuggestions(db, chatDocument, userMessages, userInfo, language) {
    try {
        // Get user's chat settings including relationship type
        const userSettings = await getUserChatToolSettings(db, userInfo._id, chatDocument._id);
        const relationshipType = userSettings?.relationshipType || 'companion';
        // Apply relationship type
        const relationshipInstructions = require('./relashionshipInstructions');
        let relationshipDescription = ''
        if (relationshipInstructions[relationshipType]) {
            relationshipDescription += `${relationshipInstructions[relationshipType]}`;
        }
        
        // Get character description
        const characterDescription = chatDataToString(chatDocument);
        const userDetails = userDetailsToString(userInfo);
        
        // Get the last few messages for context (max 6 messages)
        const recentMessages = userMessages.slice(-6);
        const conversationContext = recentMessages
            .map(msg => `${msg.role}: ${msg.content}`)
            .join('\n');

        // Create system prompt for suggestion generation
        const systemPrompt = `You are a helpful assistant that generates natural conversation suggestions for users chatting with an AI character.

Character Information:
${characterDescription}

User Information:
${userDetails}

Current Relationship Type: ${relationshipType}. ${relationshipDescription}

Based on the recent conversation context, generate exactly 3 short, natural response suggestions that the user might want to send. Each suggestion should:
1. Be contextually relevant to the conversation
2. Match the relationship dynamic (${relationshipType})
3. Be appropriate for the character's personality
4. Be conversational and engaging
5. Be brief (max 15 words each)
6. Feel natural and human-like

Recent conversation:
${conversationContext}

Generate 3 conversation suggestions in ${language}.`;

        const userPrompt = 'Generate 3 conversation suggestions based on the context above from the point of view of the user. Include the character name in the suggestions if applicable.';

        // Use OpenAI with structured output
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: zodResponseFormat(chatSuggestionsSchema, "chat_suggestions"),
            max_tokens: 300,
            temperature: 0.8,
            top_p: 0.9,
        });

        const parsedResponse = JSON.parse(response.choices[0].message.content);
        return parsedResponse.suggestions;

    } catch (error) {
        console.error('[generateChatSuggestions] Error generating suggestions:', error);
        return getDefaultSuggestions(relationshipType, language);
    }
}

/**
 * Generate default suggestions based on relationship type and language
 * @param {string} relationshipType - Type of relationship (companion, romantic, friend, etc.)
 * @param {string} language - User's language preference
 * @returns {Array} Array of 3 default suggestion strings
 */
function getDefaultSuggestions(relationshipType, language) {
    const suggestions = {
        ja: {
            companion: [
                "それについてもっと教えて",
                "興味深いですね",
                "あなたの意見は？"
            ],
            romantic: [
                "君のことをもっと知りたい",
                "一緒にいると楽しいよ",
                "今度何をしようか？"
            ],
            friend: [
                "面白い話だね！",
                "今度一緒にやろう",
                "他に何かある？"
            ]
        },
        en: {
            companion: [
                "Tell me more about that",
                "That's interesting",
                "What's your opinion?"
            ],
            romantic: [
                "I want to know more about you",
                "I enjoy our time together",
                "What should we do next?"
            ],
            friend: [
                "That's a fun story!",
                "Let's do that together",
                "What else is going on?"
            ]
        },
        fr: {
            companion: [
                "Raconte-moi en plus",
                "C'est intéressant",
                "Qu'en penses-tu ?"
            ],
            romantic: [
                "Je veux te connaître davantage",
                "J'aime passer du temps avec toi",
                "Que devrions-nous faire ensuite ?"
            ],
            friend: [
                "C'est une histoire amusante !",
                "Faisons ça ensemble",
                "Quoi d'autre se passe ?"
            ]
        }
    };

    // Get language code (convert if needed)
    const langCode = getLanguageName(language) === 'japanese' ? 'ja' : 
                     getLanguageName(language) === 'french' ? 'fr' : 'en';
    
    // Get suggestions for the relationship type, fallback to companion
    const langSuggestions = suggestions[langCode] || suggestions.en;
    return langSuggestions[relationshipType] || langSuggestions.companion;
}

/**
 * Check if suggestions should be shown (based on last message timing and user preferences)
 * @param {Array} userMessages - Array of user messages
 * @param {Object} userSettings - User's chat tool settings
 * @returns {boolean} Whether to show suggestions
 */
function shouldShowSuggestions(userMessages, userSettings) {
    // Don't show suggestions if disabled in user settings
    if (userSettings?.disableSuggestions === true) {
        return false;
    }

    // Don't show suggestions if conversation is too short
    if (userMessages.length < 2) {
        return false;
    }

    // Only show suggestions after assistant messages
    const lastMessage = userMessages[userMessages.length - 1];
    if (lastMessage?.role !== 'assistant') {
        return false;
    }

    return true;
}

module.exports = {
    generateChatSuggestions,
    getDefaultSuggestions,
    shouldShowSuggestions
};