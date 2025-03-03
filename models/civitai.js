const axios = require('axios');
const { ObjectId } = require('mongodb');
const { generateCompletion } = require('./openai');
const { generateImg } = require('./imagen');
const { checkUserAdmin } = require('./tool');
const { z } = require('zod');
const { OpenAI } = require("openai");
const { zodResponseFormat } = require("openai/helpers/zod");

// Define Zod schema for character data
const characterSchema = z.object({
  name: z.string(),
  short_intro: z.string(),
  personality_traits: z.array(z.string()),
  tags: z.array(z.string()),
  speaking_style: z.string(),
  first_message: z.string(),
  gender: z.enum(['male', 'female', 'non-binary'])
});

/**
 * Fetch a random prompt from Civitai API based on model name
 * @param {string} modelName - The name of the model to search for
 * @param {boolean} nsfw - Whether to include NSFW content
 * @returns {Promise<Object>} - A prompt object from Civitai
 */
async function fetchRandomCivitaiPrompt(modelName, nsfw = false) {
  try {
    
    // Extract the base model name by removing any version numbers and file extensions
    const baseModelName = modelName.replace(/\.safetensors$/, '').replace(/v\d+/, '').trim();
    
    // Configure the API request
    const nsfwParam = nsfw == 'true' ? '&nsfw=true' : '&nsfw=false';
    // Random limit from 30 to 100
    const limit = Math.floor(Math.random() * 71) + 30;
    const url = `https://civitai.com/api/v1/images?limit=${limit}&modelVersionName=${encodeURIComponent(baseModelName)}${nsfwParam}`;
    
    console.log(`Fetching Civitai prompts for model: ${baseModelName}`);
    console.log(`Request URL: ${url}`);

    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });
    
    if (!response.data.items || response.data.items.length === 0) {
      console.log(`No prompts found for model: ${baseModelName}`);
      return null;
    }
    
    // Select a random prompt from the results
    console.log(`Found ${response.data.items.length} prompts for model: ${baseModelName}`);
    const randomIndex = Math.floor(Math.random() * response.data.items.length);
    console.log(`Selected prompt index: ${randomIndex}`);
    const selectedItem = response.data.items[randomIndex];
    function processString(input) { 
        try {
            return [...new Set(input.slice(0, 900).split(',').map(s => s.trim()))].join(', '); 
        } catch (error) {
            console.error('Error processing string:', error);
            console.log({input})
            return input;
        }
    }
    const processedPrompt = processString(selectedItem.meta?.prompt || '');
    return {
      imageUrl: selectedItem.url,
      prompt: processedPrompt || '',
      negativePrompt: selectedItem.meta?.negativePrompt || '',
      model: selectedItem.meta?.Model || baseModelName,
      sampler: selectedItem.meta?.sampler || 'Euler a',
      cfgScale: selectedItem.meta?.cfgScale || 7,
      steps: selectedItem.meta?.steps || 30
    };
  } catch (error) {
    console.error('Error fetching Civitai prompt:', error.message);
    return null;
  }
}

/**
 * Generate a character profile based on a prompt
 * @param {string} prompt - The image prompt to base character on
 * @param {string} language - The language for response
 * @returns {Promise<Object>} - A character profile
 */
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
async function createModelChat(db, model, promptData, language = 'en', fastify = null, user = null) {
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
          vocabulary: language === 'ja' ? 'Japanese with occasional English words' : 'English',
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
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      systemGenerated: true,
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
        
        const imageType = 'sfw'; // Default to SFW images for system-generated chats
        const imageConfig = {
          title: characterData.name,
          prompt: promptData.prompt,
          aspectRatio: "portrait", // Default to portrait for character images
          userId: userId,
          chatId: chatId,
          userChatId: null, // No user chat ID for system-generated images
          imageType: imageType,
          image_num: 2, // Generate 2 images for system-generated chats
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
