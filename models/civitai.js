const axios = require('axios');
const { ObjectId } = require('mongodb');
const { generateCompletion } = require('./openai');
const { generateImg } = require('./imagen');
const { checkUserAdmin } = require('./tool');
const { z } = require('zod');
const { OpenAI } = require("openai");
const { zodResponseFormat } = require("openai/helpers/zod");

/**
 * Fetch a random prompt from Civitai API based on model name
 * @param {string} modelName - The name of the model to search for
 * @param {boolean} nsfw - Whether to include NSFW content
 * @returns {Promise<Object|false>} - A prompt object from Civitai or false if none found
 */
async function fetchRandomCivitaiPrompt(modelData, nsfw = false) {
  try {
    // Extract the base model name by removing any version numbers and file extensions
    const baseModelName = modelData.model.replace(/\.safetensors$/, '').replace(/v\d+/, '').trim();
    const modelId = modelData.modelId;
    // Configure the API request
    const nsfwParam = nsfw == 'true' ? '&nsfw=true' : '&nsfw=false';
    const maxAttempts = 5; // Maximum number of attempts to find a prompt
    
    console.log(`Fetching Civitai prompts for model: ${baseModelName}`);
    
    // Try multiple pages with a small limit to find a valid prompt
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const page = Math.floor(Math.random() * 10) + 1; // Random page between 1 and 10
      const limit = 30;
      const url = `https://civitai.com/api/v1/images?limit=${limit}&page=${page}&modelVersionId=${encodeURIComponent(modelId)}${nsfwParam}`;
      
      console.log(`Attempt ${attempt}/${maxAttempts} - Request URL: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });
      
      if (response.data.items && response.data.items.length > 0) {        
        // Filter all items with valid prompts
        const validItems = response.data.items.filter(item => 
          item.meta?.prompt && typeof item.meta.prompt === 'string' && item.meta.prompt.trim().length > 0
        );

        // Select a random item from the filtered valid items
        const validItem = validItems.length > 0 ? 
          validItems[Math.floor(Math.random() * validItems.length)] : 
          undefined;
        
        if (validItem) {          
          function processString(input) { 
            try {
              if (!input || typeof input !== 'string' || input.length === 0) {
                return false;
              }
              return [...new Set(input.slice(0, 900).split(',').map(s => s.trim()))].join(', '); 
            } catch (error) {
              console.error('Error processing string:', error);
              console.log({input});
              return false;
            }
          }
          
          const processedPrompt = processString(validItem.meta.prompt);
          
          if (!processedPrompt) {
            console.log('Prompt processing failed, continuing to next attempt');
            continue;
          }
          
          return {
            imageUrl: validItem.url || "",
            prompt: processedPrompt,
            negativePrompt: validItem.meta?.negativePrompt || 'low quality, bad anatomy, worst quality',
            model: validItem.meta?.Model || baseModelName,
            modelId,
            sampler: validItem.meta?.sampler || 'Euler a',
            cfgScale: validItem.meta?.cfgScale || 7,
            steps: validItem.meta?.steps || 30
          };
        }
      }
      
      console.log(`No valid prompts found in attempt ${attempt}, trying again...`);
    }
    
    console.log(`No valid prompts found after ${maxAttempts} attempts for model: ${baseModelName}`);
    return false;
    
  } catch (error) {
    console.error('Error fetching Civitai prompt:', error.message);
    return false;
  }
}

/**
 * Generate a character profile based on a prompt
 * @param {string} prompt - The image prompt to base character on
 * @param {string} language - The language for response
 * @returns {Promise<Object>} - A character profile
 */
// Define Zod schema for character data
const characterSchema = z.object({
  name: z.string(),
  short_intro: z.string(),
  personality_traits: z.array(z.string()),
  tags: z.array(z.string()),
  speaking_style: z.string(),
  first_message: z.string(),
  gender: z.enum(['male', 'female', 'nonBinary'])
});

async function generateCharacterFromPrompt(prompt, language = 'japanese') { 
  try {
    const openai = new OpenAI();
    
    const systemPrompt = `You are a creative character designer. Based on the prompt description, create a detailed character profile in ${language}.
    Include the following: 
    - A unique name appropriate for the character design and gender
    - Brief character backstory (2-3 sentences)
    - Personality traits (3 main traits)
    - A list of tags to find the character in search
    - Speaking style (formal/casual/slang/etc)
    - Default first interaction message
    
    Response will be used as JSON with name, short_intro, personality_traits array, tags array, speaking_style, first_message, and gender fields.`;
    
    const userPrompt = `Create a character based on this image prompt: ${prompt}.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: zodResponseFormat(characterSchema, "character"),
      temperature: 0.8,
      max_tokens: 800
    });

    // Parse the response with Zod schema
    const characterData = JSON.parse(response.choices[0].message.content);
    return characterSchema.parse(characterData);

  } catch (error) {
    console.error('Error generating character from prompt:', error);
    
    // Fallback character if there's an error
    return characterSchema.parse({
      name: "AI Character",
      short_intro: "A digital character created by AI.",
      personality_traits: ["Friendly", "Helpful", "Curious"],
      speaking_style: "Casual and approachable",
      first_message: "Hi there! Nice to meet you!",
      gender: "female"
    });
  }
}

/**
 * Create a new chat based on model and prompt data
 * @param {Object} db - MongoDB database connection
 * @param {Object} model - Model info from database
 * @param {Object} promptData - Prompt data from Civitai
 * @param {String} language - Language for the chat
 * @param {Object} fastify - Fastify instance for websockets
 * @param {Object} user - Current user making the request
 * @returns {Promise<Object>} - The created chat document
 */
async function createModelChat(db, model, promptData, language = 'en', fastify = null, user = null, nsfw = false) {
  try {
    const chatsCollection = db.collection('chats');
    const tagsCollection = db.collection('tags');
    
    // Generate character based on the prompt
    const characterData = await generateCharacterFromPrompt(promptData.prompt, language);
    
    // Create tags from prompt
    const promptTags = extractTagsFromPrompt(promptData.prompt);

    // Create a new chat document
    const chatData = {
      name: characterData.name,
      short_intro: characterData.short_intro,
      base_personality: {
        traits: characterData.personality_traits,
        preferences: promptTags.slice(0, 3),
        expression_style: {
          tone: characterData.speaking_style,
          vocabulary: language,
          unique_feature: characterData.personality_traits[0] || 'Friendly'
        }
      },
      tags: characterData.tags || promptTags,
      first_message: characterData.first_message,
      characterPrompt: promptData.prompt,
      enhancedPrompt: promptData.prompt, // Use same prompt for now
      gender: characterData.gender,
      language,
      imageModel: model.model,
      modelId: model.modelId,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      systemGenerated: true,
      nsfw: nsfw,
      visibility: 'public',
      imageVersion: model.version || 'sd'
    };

    // Insert the chat
    const result = await chatsCollection.insertOne(chatData);
    const chatId = result.insertedId;
    
    // Save tags to the database
    for (const tag of promptTags) {
      await tagsCollection.updateOne(
        { name: tag },
        { $set: { name: tag, language }, $addToSet: { chatIds: chatId } },
        { upsert: true }
      );
    }
    
    console.log(`Created new chat: ${chatData.name} with ID: ${chatId}`);
    
    // Generate image for the chat if fastify instance is provided
    if (fastify) {
      try {
        console.log(`Generating image for chat: ${chatId}`);
        
        // Use the provided user or verify admin access
        let userId;
        
        if (user && user._id) {
          // Use provided user if available
          userId = user._id;
          console.log(`Using provided user ID for image generation: ${userId}`);
        } else {
          console.log('No user provided for image generation, chat created but no image will be generated');
          return { ...chatData, _id: chatId };
        }
        
        // Verify the user is an admin before allowing image generation
        const isAdmin = await checkUserAdmin(fastify, userId);
        if (!isAdmin) {
          console.log(`User ${userId} is not an admin, skipping image generation`);
          return { ...chatData, _id: chatId };
        }
        
        const imageType = nsfw == 'true' ? 'nsfw' : 'sfw';
        const imageConfig = {
          title: characterData.name,
          prompt: chatData.gender +','+ promptData.prompt,
          negativePrompt: promptData.negativePrompt,
          aspectRatio: "portrait", // Default to portrait for character images
          userId: userId,
          chatId: chatId,
          userChatId: null, // No user chat ID for system-generated images
          imageType: imageType,
          image_num: 4, // Generate 2 images for system-generated chats
          chatCreation: true,
          placeholderId: chatId.toString(),
          translations: {
            newCharacter: {
              imageCompletionDone_title: 'Character Image Generated',
              imageCompletionDone_message: 'The character image has been generated successfully.',
              errorInitiatingImageGeneration: 'Failed to generate character image.'
            }
          },
          fastify
        };
        
        await generateImg(imageConfig);
        console.log(`Image generation initiated for chat: ${chatId}`);
      } catch (imageError) {
        console.error('Error generating image for chat:', imageError);
        // Continue without image if generation fails
      }
    }
    
    return { ...chatData, _id: chatId };
  } catch (error) {
    console.error('Error creating model chat:', error);
    return null;
  }
}

/**
 * Extract tags from a prompt
 * @param {string} prompt - The image prompt
 * @returns {Array<string>} - Array of tags
 */
function extractTagsFromPrompt(prompt) {
  // Split prompt by commas and clean up
  const tags = prompt
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 2 && tag.length < 20) // Filter by length
    .filter(tag => !tag.includes('(') && !tag.includes(')')) // Remove tags with parenthesis
    .filter(tag => !tag.match(/[!@#$%^&*(),.?":{}|<>]/)) // Remove tags with special characters
    .filter(tag => !tag.includes('_'))
    .filter(tag => !tag.match(/^\d/)); // Remove tags starting with numbers
  
  // Remove duplicate tags and limit to 10
  return [...new Set(tags)].slice(0, 10);
}

module.exports = {
  fetchRandomCivitaiPrompt,
  createModelChat
};
