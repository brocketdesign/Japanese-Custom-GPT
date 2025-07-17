const axios = require('axios');
const { ObjectId } = require('mongodb');
const { generateCompletion } = require('./openai');
const { generateImg } = require('./imagen');
const { checkUserAdmin } = require('./tool');
const { z } = require('zod');
const { OpenAI } = require("openai");
const { zodResponseFormat } = require("openai/helpers/zod");

/**
 * Check if prompt contains forbidden words
 * @param {string} prompt - The prompt text to check
 * @param {Array<string>} forbiddenWords - Array of forbidden words/phrases
 * @returns {boolean} - True if prompt contains forbidden words
 */
function containsForbiddenWords(prompt, forbiddenWords = []) {
  if (!forbiddenWords || forbiddenWords.length === 0) return false;
  
  const lowerPrompt = prompt.toLowerCase();
  return forbiddenWords.some(word => {
    const lowerWord = word.toLowerCase().trim();
    return lowerWord && lowerPrompt.includes(lowerWord);
  });
}

/**
 * Get forbidden words from database
 * @param {Object} db - MongoDB database connection
 * @returns {Promise<Array<string>>} - Array of forbidden words
 */
async function getForbiddenWords(db) {
  try {
    const settingsCollection = db.collection('systemSettings');
    const forbiddenWordsSettings = await settingsCollection.findOne({ type: 'forbiddenWords' });
    
    if (forbiddenWordsSettings && forbiddenWordsSettings.words) {
      return forbiddenWordsSettings.words.filter(word => word && word.trim().length > 0);
    }
    
    return [];
  } catch (error) {
    console.error('[getForbiddenWords] Error fetching forbidden words:', error);
    return [];
  }
}

/**
 * Fetch a random prompt from Civitai API based on model name
 * @param {string} modelData - The model data object
 * @param {boolean} nsfw - Whether to include NSFW content
 * @param {number} page - Page number to fetch
 * @param {number} promptIndex - Index of prompt within the page
 * @param {boolean} excludeUsed - Whether to exclude used/skipped prompts
 * @param {Object} db - MongoDB database connection
 * @returns {Promise<Object|false>} - A prompt object from Civitai or false if none found
 */
async function fetchRandomCivitaiPrompt(modelData, nsfw = false, page = 1, promptIndex = 0, excludeUsed = true, db = null) {
  try {
    const baseModelName = modelData.model.replace(/\.safetensors$/, '').replace(/v\d+/, '').trim();
    const modelId = modelData.modelId;
    const nsfwParam = nsfw == 'true' ? '&nsfw=true' : '&nsfw=false';
    const maxRetries = 10; // Try up to 10 different prompts/pages
    let currentPage = page || 1;
    let currentPromptIndex = promptIndex || 0;
    let targetIndex = promptIndex || 0; // Keep track of the target index we're looking for
    
    console.log(`[fetchRandomCivitaiPrompt] Starting search for model: ${baseModelName}, page: ${currentPage}, promptIndex: ${currentPromptIndex}, nsfw: ${nsfw}, excludeUsed: ${excludeUsed}`);
    
    // Get used/skipped prompts and forbidden words
    let usedPrompts = new Set();
    let forbiddenWords = [];
    
    if (db) {
      if (excludeUsed) {
        const promptTrackingCollection = db.collection('promptTracking');
        const usedPromptsData = await promptTrackingCollection.find({
          modelId,
          $or: [{ status: 'used' }, { status: 'skipped' }]
        }).toArray();
        usedPrompts = new Set(usedPromptsData.map(p => p.promptHash));
        console.log(`[fetchRandomCivitaiPrompt] Found ${usedPrompts.size} used/skipped prompts for model ${modelId}`);
      }
      
      // Get forbidden words
      forbiddenWords = await getForbiddenWords(db);
      console.log(`[fetchRandomCivitaiPrompt] Found ${forbiddenWords.length} forbidden words`);
    }
    
    // Try to find the prompt at the specific index first
    for (let retry = 0; retry < maxRetries; retry++) {
      console.log(`[fetchRandomCivitaiPrompt] Retry ${retry + 1}/${maxRetries} - Page: ${currentPage}, Looking for index: ${targetIndex}`);
      
      try {
        const limit = 30;
        const url = `https://civitai.com/api/v1/images?limit=${limit}&page=${currentPage}&modelVersionId=${encodeURIComponent(modelId)}${nsfwParam}`;

        console.log(`[fetchRandomCivitaiPrompt] Fetching from ${url}`);

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

          console.log(`[fetchRandomCivitaiPrompt] Found ${validItems.length} items with valid prompts on page ${currentPage}`);

          // Create an array to track which items are suitable (not used/skipped, no forbidden words)
          let suitableItems = [];
          
          for (let i = 0; i < validItems.length; i++) {
            const item = validItems[i];
            const rawPrompt = item.meta.prompt;
            
            // Process the prompt
            const processedPrompt = processString(rawPrompt);
            if (!processedPrompt) {
              console.log(`[fetchRandomCivitaiPrompt] Prompt processing failed for index ${i}, skipping`);
              continue;
            }

            // Generate prompt hash for tracking
            const promptHash = require('crypto').createHash('md5').update(processedPrompt).digest('hex');
            
            // Check if prompt was already used/skipped
            if (excludeUsed && usedPrompts.has(promptHash)) {
              console.log(`[fetchRandomCivitaiPrompt] Prompt already used/skipped (hash: ${promptHash}), skipping`);
              continue;
            }
            
            // Check for forbidden words
            if (containsForbiddenWords(processedPrompt, forbiddenWords)) {
              console.log(`[fetchRandomCivitaiPrompt] Prompt contains forbidden words, marking as skipped`);
              // Mark as skipped so we never see it again
              if (db) {
                await markPromptStatus(db, modelId, promptHash, 'skipped');
              }
              continue;
            }
            
            // This item is suitable
            suitableItems.push({
              index: i,
              item,
              processedPrompt,
              promptHash
            });
          }
          
          console.log(`[fetchRandomCivitaiPrompt] Found ${suitableItems.length} suitable items on page ${currentPage}`);
          
          // If we have suitable items, try to find the one at our target index
          if (suitableItems.length > 0) {
            // If targetIndex is within range of suitable items, use it
            if (targetIndex < suitableItems.length) {
              const suitableItem = suitableItems[targetIndex];
              console.log(`[fetchRandomCivitaiPrompt] Found suitable prompt at target index ${targetIndex} (actual index ${suitableItem.index}) on page ${currentPage}`);
              
              return {
                imageUrl: suitableItem.item.url || "",
                prompt: suitableItem.processedPrompt,
                promptHash: suitableItem.promptHash,
                negativePrompt: suitableItem.item.meta?.negativePrompt || 'low quality, bad anatomy, worst quality',
                model: suitableItem.item.meta?.Model || baseModelName,
                modelId,
                sampler: suitableItem.item.meta?.sampler || 'Euler a',
                cfgScale: suitableItem.item.meta?.cfgScale || 7,
                steps: suitableItem.item.meta?.steps || 30,
                page: currentPage,
                promptIndex: targetIndex,
                totalItems: suitableItems.length
              };
            } else {
              // Target index is beyond this page, try next page
              console.log(`[fetchRandomCivitaiPrompt] Target index ${targetIndex} beyond page ${currentPage} (has ${suitableItems.length} items), trying next page`);
              currentPage++;
              targetIndex = targetIndex - suitableItems.length; // Adjust target index for next page
              continue;
            }
          } else {
            // No suitable items on this page, try next page
            console.log(`[fetchRandomCivitaiPrompt] No suitable items on page ${currentPage}, trying next page`);
            currentPage++;
            continue;
          }
        } else {
          console.log(`[fetchRandomCivitaiPrompt] No items found on page ${currentPage}, trying next page`);
          currentPage++;
        }
      } catch (pageError) {
        console.error(`[fetchRandomCivitaiPrompt] Error fetching page ${currentPage}:`, pageError.message);
        // Try next page on error
        currentPage++;
      }
    }
    
    console.log(`[fetchRandomCivitaiPrompt] No suitable prompts found after ${maxRetries} retries for model: ${baseModelName}`);
    return false;
    
  } catch (error) {
    console.error('[fetchRandomCivitaiPrompt] Error fetching Civitai prompt:', error.message);
    return false;
  }
  
  function processString(input) { 
    try {
      if (!input || typeof input !== 'string' || input.length === 0) {
        return false;
      }
      return [...new Set(input.slice(0, 900).split(',').map(s => s.trim()))].join(', '); 
    } catch (error) {
      console.error('[fetchRandomCivitaiPrompt/processString] Error processing string:', error);
      return false;
    }
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
    
    if(!user){
      user = fastify?.user || null;
    }

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
      const civitaiRequest = {
        userId: user ? user._id : null,
        prompt: promptData.prompt,
        negativePrompt: promptData.negativePrompt || null,
        language: language,
        system_generated: true,
        nsfw: nsfw,
        enableEnhancedPrompt: false,
      }
      // [DEBUG] Log the request data
      console.log(`[civitai/createModelChat] Request data:`, civitaiRequest);
      
      const apiResponse = await axios.post(`${apiUrl}/api/generate-character-comprehensive`, civitaiRequest);

      const chatData = apiResponse.data.chatData;
      const chatId = apiResponse.data.chatId;

      if (!chatData || !chatData.name) {
        throw new Error('[civitai/createModelChat] Invalid character data received from API');
      }
      console.log('[civitai/createModelChat] Full character data received from API:', chatData.name);
      console.log(`[civitai/createModelChat] Chat ID: ${chatId}`);
      try {
        // Update the chatdData with systemGenerated true
        const result = await fastify.mongo.db.collection('chats').updateOne(
          { _id: new ObjectId(chatId) },
          { $set: { 
            systemGenerated: true,
            imageModel: model.model,
            civitaiModelId: model.modelId,
            modelName: model.model,
            modelId: model.modelId,
          } }
        );
        if (result.modifiedCount === 0) {
          console.warn('[civitai/createModelChat] No chat updated with systemGenerated flag');
        } else {
          console.log('[civitai/createModelChat] Chat updated with systemGenerated flag successfully');
        }
      } catch (error) {
        console.error('[civitai/createModelChat] Error updating chat with systemGenerated flag:', error);
      }

      return { ...chatData, _id: chatId, slug: chatData.slug };
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
