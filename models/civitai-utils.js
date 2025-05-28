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
async function fetchRandomCivitaiPrompt(modelData, nsfw = false, page = 1, promptIndex = 0, excludeUsed = true, db = null) {
  try {
    const baseModelName = modelData.model.replace(/\.safetensors$/, '').replace(/v\d+/, '').trim();
    const modelId = modelData.modelId;
    const nsfwParam = nsfw == 'true' ? '&nsfw=true' : '&nsfw=false';
    const maxAttempts = 5;
    
    console.log(`[fetchRandomCivitaiPrompt] Fetching Civitai prompts for model: ${baseModelName}, page: ${page}, promptIndex: ${promptIndex}, nsfw: ${nsfw}, excludeUsed: ${excludeUsed}`);
    
    // Get used/skipped prompts if db is provided and excludeUsed is true
    let usedPrompts = new Set();
    if (db && excludeUsed) {
      const promptTrackingCollection = db.collection('promptTracking');
      const usedPromptsData = await promptTrackingCollection.find({
        modelId,
        $or: [{ status: 'used' }, { status: 'skipped' }]
      }).toArray();
      usedPrompts = new Set(usedPromptsData.map(p => p.promptHash));
      console.log(`[fetchRandomCivitaiPrompt] Found ${usedPrompts.size} used/skipped prompts for model ${modelId}`);
    }
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      page = page || 1;
      const limit = 30;
      const url = `https://civitai.com/api/v1/images?limit=${limit}&page=${page}&modelVersionId=${encodeURIComponent(modelId)}${nsfwParam}`;

      console.log(`[fetchRandomCivitaiPrompt] Attempt ${attempt}: Fetching from ${url}`);

      const response = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      if (response.data.items && response.data.items.length > 0) {        
        // Filter all items with valid prompts
        let validItems = response.data.items.filter(item => 
          item.meta?.prompt && typeof item.meta.prompt === 'string' && item.meta.prompt.trim().length > 0
        );

        // If excludeUsed is true, filter out used/skipped prompts
        if (excludeUsed && usedPrompts.size > 0) {
          validItems = validItems.filter(item => {
            const promptHash = require('crypto').createHash('md5').update(item.meta.prompt).digest('hex');
            return !usedPrompts.has(promptHash);
          });
          console.log(`[fetchRandomCivitaiPrompt] After filtering used prompts: ${validItems.length} valid items remaining`);
        }

        const randomIndex = parseInt(promptIndex) + 1 || 1;
        const validItem = validItems.length > 0 ? validItems[randomIndex] : undefined;
        
        if (validItem) {          
          function processString(input) { 
            try {
              if (!input || typeof input !== 'string' || input.length === 0) {
                return false;
              }
              return [...new Set(input.slice(0, 900).split(',').map(s => s.trim()))].join(', '); 
            } catch (error) {
              console.error('[fetchRandomCivitaiPrompt/processString] Error processing string:', error);
              console.log({input});
              return false;
            }
          }
          
          const processedPrompt = processString(validItem.meta.prompt);
          
          if (!processedPrompt) {
            console.log('[fetchRandomCivitaiPrompt] Prompt processing failed, continuing to next attempt');
            continue;
          }

          // Generate prompt hash for tracking
          const promptHash = require('crypto').createHash('md5').update(processedPrompt).digest('hex');
          
          console.log(`[fetchRandomCivitaiPrompt] Successfully found valid prompt with hash: ${promptHash}`);
          
          return {
            imageUrl: validItem.url || "",
            prompt: processedPrompt,
            promptHash,
            negativePrompt: validItem.meta?.negativePrompt || 'low quality, bad anatomy, worst quality',
            model: validItem.meta?.Model || baseModelName,
            modelId,
            sampler: validItem.meta?.sampler || 'Euler a',
            cfgScale: validItem.meta?.cfgScale || 7,
            steps: validItem.meta?.steps || 30,
            page,
            promptIndex: randomIndex,
            totalItems: validItems.length
          };
        }
      }
      
      console.log(`[fetchRandomCivitaiPrompt] No valid prompts found in attempt ${attempt}, trying again...`);
    }
    
    console.log(`[fetchRandomCivitaiPrompt] No valid prompts found after ${maxAttempts} attempts for model: ${baseModelName}`);
    return false;
    
  } catch (error) {
    console.error('[fetchRandomCivitaiPrompt] Error fetching Civitai prompt:', error.message);
    return false;
  }
}

/**
 * Mark a prompt as used in the database
 * @param {Object} db - MongoDB database connection
 * @param {string} modelId - Model ID
 * @param {string} promptHash - Hash of the prompt
 * @param {string} status - Status: 'used' or 'skipped'
 */
async function markPromptStatus(db, modelId, promptHash, status = 'used') {
  try {
    console.log(`[markPromptStatus] Marking prompt ${promptHash} as ${status} for model ${modelId}`);
    
    const promptTrackingCollection = db.collection('promptTracking');
    await promptTrackingCollection.updateOne(
      { modelId, promptHash },
      {
        $set: {
          modelId,
          promptHash,
          status,
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
    
    console.log(`[markPromptStatus] Successfully marked prompt ${promptHash} as ${status}`);
  } catch (error) {
    console.error('[markPromptStatus] Error marking prompt status:', error);
  }
}

async function createModelChat(db, model, promptData, language = 'en', fastify = null, user = null, nsfw = false) {
  try {
    console.log(`[createModelChat] Starting chat creation for model: ${model.model}`);
    
    // Validate promptData.prompt
    if (!promptData.prompt || promptData.prompt.trim() === '') {
        console.log('[createModelChat] Missing required fields');
        return
    }

    // Mark prompt as used (this is the only new addition)
    if (promptData.promptHash) {
      await markPromptStatus(db, model.modelId, promptData.promptHash, 'used');
    }

    try {
      // API call to the openai-chat-creation endpoint
      const apiUrl = process.env.MODE === 'local' ? 'http://localhost:3000' :  'https://app.chatlamix.com';
      const apiResponse = await axios.post(`${apiUrl}/api/generate-character-comprehensive`, {
        prompt: promptData.prompt,
        language: language,
        system_generated: true,
        nsfw: nsfw,
      });

      const chatData = apiResponse.data.chatData;
      if (!chatData || !chatData.name) {
        throw new Error('[civitai/createModelChat] Invalid character data received from API');
      }
      console.log('[civitai/createModelChat] Full character data received from API:', chatData.name);
      try {
        // Update the chatdData with systemGenerated true
        const result = await fastify.mongo.db.collection('chats').updateOne(
          { _id: new ObjectId(apiResponse.data.chatId) },
          { $set: { systemGenerated: true } }
        );
        if (result.modifiedCount === 0) {
          console.warn('[civitai/createModelChat] No chat updated with systemGenerated flag');
        } else {
          console.log('[civitai/createModelChat] Chat updated with systemGenerated flag successfully');
        }
      } catch (error) {
        console.error('[civitai/createModelChat] Error updating chat with systemGenerated flag:', error);
      }
      try {
        const imageType = nsfw == 'true' ? 'nsfw' : 'sfw';
        const imageConfig = {
          title: chatData.name,
          prompt: chatData.characterPrompt || promptData.enhancedPrompt,
          negativePrompt: promptData.negativePrompt,
          aspectRatio: "portrait",
          userId: user ? user._id : null,
          chatId: apiResponse.data.chatId,
          userChatId: null,
          imageType: imageType,
          image_num: 4, // Generate 2 images for system-generated chats
          chatCreation: true,
          placeholderId: apiResponse.data.chatId.toString(),
          translations: {
            newCharacter: {
              imageCompletionDone_title: 'Character Image Generated',
              imageCompletionDone_message: 'The character image has been generated successfully.',
              errorInitiatingImageGeneration: 'Failed to generate character image.'
            }
          },
          fastify
        };
        
        generateImg(imageConfig);
      } catch (error) {
        console.log('[civitai/createModelChat] Error generating character image:', error);
      }

      return { ...chatData, _id: chatData.chatId, slug: chatData.slug };
    } catch (apiError) {
      console.error('[civitai/createModelChat] Error calling openai-chat-creation API:', apiError);
      return false;
    }

  } catch (error) {
    console.error('[createModelChat] Error creating model chat:', error);
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
  createModelChat,
  markPromptStatus
};
