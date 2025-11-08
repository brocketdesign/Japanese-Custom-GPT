const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { createParser } = require('eventsource-parser');
const { OpenAI } = require("openai");
const { z } = require("zod");
const { zodResponseFormat } = require("openai/helpers/zod");
const { sanitizeMessages } = require('./tool')

const apiDetails = {
  openai: {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
    key: process.env.OPENAI_API_KEY
  },
  novita: {
    apiUrl: 'https://api.novita.ai/v3/openai/chat/completions',
    key: process.env.NOVITA_API_KEY,
    models: {
      llama: 'meta-llama/llama-3-70b-instruct',
      deepseek: 'deepseek/deepseek-v3-turbo',
      mistral: 'mistralai/mistral-nemo',
      hermes: 'nousresearch/hermes-2-pro-llama-3-8b'
    }
  },
};

// Default model config
let currentModelConfig = {
  provider: 'openai',
  modelName: 'gpt-4o'
};

// Enhanced model config with categorization
const modelConfig = {
  free: {
    openai: {
      provider: 'openai',
      modelName: null,
      displayName: 'OpenAI gpt-4o',
      description: 'Advanced reasoning and creativity'
    },
  },
  premium: {
    llama: {
      provider: 'novita',
      modelName: 'llama',
      displayName: 'Llama 3 70B',
      description: 'Large-scale reasoning and analysis'
    },
    deepseek: {
      provider: 'novita',
      modelName: 'deepseek',
      displayName: 'DeepSeek V3 Turbo',
      description: 'Advanced coding and reasoning'
    },
    hermes: {
      provider: 'novita',
      modelName: 'hermes',
      displayName: 'Hermes 2 Pro',
      description: 'Balanced performance and speed'
    }
  }
};
// Helper function to get all available models
const getAllAvailableModels = (isPremium = false) => {
  const models = { ...modelConfig.free, ...modelConfig.premium };
  return models;
};
// Helper function to get available models based on subscription
const getAvailableModels = (isPremium = false) => {
  const models = { ...modelConfig.free };
  if (isPremium) {
    Object.assign(models, modelConfig.premium);
  }
  return models;
};

// Helper function to get model config by key
const getModelConfig = (modelKey, isPremium = false) => {
  const availableModels = getAvailableModels(isPremium);
  return availableModels[modelKey] || availableModels.hermes; // Default to hermes
};

const moderateText = async (text) => {
  try {
    const openai = new OpenAI();
    const moderation = await openai.moderations.create({
      model: "omni-moderation-latest",
      input: text,
    });
    return moderation;
  } catch (error) {
    console.error("Error moderating text:", error);
    throw error;
  }
};

const moderateImage = async (imageUrl) => {
  try {
    const openai = new OpenAI();
    const moderation = await openai.moderations.create({
      model: "omni-moderation-latest",
      input: [
        {
          type: "image_url",
          image_url: {
            url: imageUrl
          }
        }
      ],
    });
    return moderation;
  } catch (error) {
    console.error("Error moderating image:", error);
    throw error;
  }
};


async function generateCompletion(messages, maxToken = 1000, model = null, lang = 'en', userModelPreference = null, isPremium = false) {
  // Determine which model configuration to use
  let modelConfig = { ...currentModelConfig };
  
  // Check if user has a model preference and it's available
  if (userModelPreference) {
    const userModelConfig = getModelConfig(userModelPreference, isPremium);
    if (userModelConfig) {
      modelConfig.provider = userModelConfig.provider;
      modelConfig.modelName = userModelConfig.modelName;
    }
  }
  
  if (model) {
    if (apiDetails[model]) {
      // Direct provider like 'openai'
      modelConfig.provider = model;
      modelConfig.modelName = null;
    } else {
      // Specific model like 'deepseek'
      for (const provider in apiDetails) {
        if (apiDetails[provider].models && apiDetails[provider].models[model]) {
          modelConfig.provider = provider;
          modelConfig.modelName = model;
          break;
        }
      }
    }
  }

  // Get the API details
  const provider = apiDetails[modelConfig.provider];
  const modelName = modelConfig.modelName ? 
    provider.models[modelConfig.modelName] : 
    provider.model;

  console.log(`[generateCompletion] Using model: ${modelName}`);
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(provider.apiUrl, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${provider.key}`
        },
        method: "POST",
        body: JSON.stringify({
          model: modelName,
          messages,
          temperature: 1,
          max_completion_tokens: maxToken,
          stream: false,
          n: 1,
        }),
      });
      // Rest of your function remains the same
      if (!response.ok) {
        if (attempt === 2) {
          const errorData = await response.json().catch(() => ({}));
          console.log(`Failed after ${attempt} attempts:`, errorData.error?.message || '');
          return false;
        }
        continue; // Try second attempt
      }

      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (error) {
      if (attempt === 2) {
        console.error(`Failed after ${attempt} attempts:`, error.message);
        return false;
      }
    }
  }
}

// Define the schema for the response format
const formatSchema = z.object({
  image_request: z.boolean(),
  nsfw: z.boolean(),
  reason: z.string()
});
const checkImageRequest = async (lastAssistantMessage,lastUserMessage) => {

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    if (!lastAssistantMessage && !lastUserMessage) return {};

    const commandPrompt = `
      You are a helpful assistant designed to evaluate whether the assistant's response is trying to generate an image. \n
      1. **image_request**: true if the message is an explicit request for image generation, false otherwise.
      2. **nsfw**: Based on the request, what is the kind of image that should be generated ? true if the content is explicit or adult-oriented, false otherwise.
      3. **reason**: you explain why it is an image request or not.
    `;
    const analysisPrompt = `
      Analyze the following request considering ALL aspects:\n\n
      "User: ${lastUserMessage}"\n
      "Assistant: ${lastAssistantMessage}"\n\n
      Is the assistant trying to send an image following the user message ?
      Format response using JSON object with the following keys: image_request, nsfw, reason.
    `;
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: "system", content: commandPrompt },
        { role: "user", content: analysisPrompt }
      ],
      response_format: zodResponseFormat(formatSchema, "image_instructions"),
      max_completion_tokens: 600,
      temperature: 1,
    });


    const genImage = JSON.parse(response.choices[0].message.content);
    return genImage

  } catch (error) {
    console.log('Analysis error:', error);
    return formatSchema.partial().parse({});
  }
};


// Enhanced schema with relation analysis
const enhancedAnalysisSchema = z.object({
  relation_update: z.boolean(),
  custom_relation: z.string().optional(),
  custom_instruction: z.string().optional(),
  conversation_tone: z.string().optional(),
});

// New function to analyze conversation context and provide enhanced analysis
const analyzeConversationContext = async (messages, userInfo, language) => {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // Get all user messages for context
  const allMessages = messages
    .filter(m => m.content && !m.content.startsWith('[Image]') && m.role !== 'system' && m.name !== 'context' && m.name !== 'master')
    .map(msg => ({
        role: msg.role,
        content: msg.content,
        custom_relation: msg.custom_relation || null,
        timestamp: msg.timestamp || null
      }));

  const lastAssistantRelation = messages
    .filter(msg => msg.role === 'assistant')
    .slice(-1)
    .map(msg => msg.custom_relation)
    .join(', ');

  // Get the latest message for image analysis
  const lastUserMessage = allMessages.length > 0 ? allMessages[allMessages.length - 1] : null;
  if (!lastUserMessage) return {};

  // Count images in the conversation
  const imageCount = messages.filter(msg => msg.content && msg.content.startsWith('[Image]')).length;
  
  // Calculate time differences if timestamps exist
  let timeDifference = null;
  if (allMessages.length >= 2 && allMessages[allMessages.length - 1].timestamp && allMessages[allMessages.length - 2].timestamp) {
    const lastTime = new Date(allMessages[allMessages.length - 1].timestamp);
    const prevTime = new Date(allMessages[allMessages.length - 2].timestamp);
    timeDifference = Math.floor((lastTime - prevTime) / (1000 * 60)); // In minutes
  }

  const commandPrompt = `
    You are a character personality guide that helps tailor responses based on the conversation context.
    
    Analyze the messages and provide:
    
    1. **custom_relation**: Define the current relationship dynamic from your perspective. Respond in 3 words maximum. Respond in ${language}.
    2. **custom_instruction**: A brief instruction for how the character should respond based on personality and context. Suitable for a chat response. Make them short and relevant to the user's chat.
    3. **conversation_tone**: Identify the appropriate tone for responses (e.g., "flirty", "angry", "playful", "romantic").
     
    You may refuse the user advance if the relationship is not in accordance with the character's personality.
    Focus on maintaining character consistency while adapting to conversation flow. 
    Regarding the relationship update, consider the character's personality, the user's chat history and the last relationship update.
    \nIf the character should be angry, playful, or make jokes based on context, reflect that in your instructions.
  `;

  const analysisPrompt = `
  Analyze the following conversation context:
  ${JSON.stringify(allMessages)}
  
  Latest message: "${lastUserMessage.content}"
  Number of images shared in the conversation: ${imageCount}.
  Time difference between the last two messages: ${timeDifference} minutes.
  Last relationship update: "${lastAssistantRelation}".

  Make sure the character is okay with the relationship update before proceeding. 
  \nDo not necessarily follow the user's request. You must have a personality and a relationship with the user adn it depend on the image number.
  \nThe more images the more intimate, low images number (<10) lower intimitie.
  
  Format response using JSON object with all fields from the schema.

  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: "system", content: commandPrompt },
        { role: "user", content: analysisPrompt }
      ],
      response_format: zodResponseFormat(enhancedAnalysisSchema, "conversation_analysis"),
      max_completion_tokens: 800,
      temperature: 1,
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    return analysis;

  } catch (error) {
    console.log('Conversation analysis error:', error);
    return enhancedAnalysisSchema.partial().parse({
      nsfw: false,
      image_request: false,
      image_num: 1,
      relation_update: false
    });
  }
};

async function generatePromptSuggestions(messages, chatDescription, language, model = 'hermes') {

  // Get the last user message
  let lastUserMessagesContent = messages
    .filter(m => m.content && !m.content.startsWith('[Image]') && m.role !== 'system')
    .slice(-5);

  console.log(`[generatePromptSuggestions] Using OpenAI gpt-4o-mini for stable structured output in language: ${language}`);

  // Define Zod schemas for each category
  const chatSchema = z.object({
    chat: z.array(z.string()).length(3)
  });

  const feelingsSchema = z.object({
    feelings: z.array(z.string()).length(3)
  });

  const image_requestSchema = z.object({
    image_request: z.array(z.string()).length(3)
  });

  // Create separate request functions for each category using OpenAI
  const generateCategory = async (categoryName, categoryPrompt, schema) => {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { 
        role: "system", 
        content: `Generate exactly 3 ${categoryName} suggestions in ${language}. ${categoryPrompt} Be creative and engaging. Include emojis for visual appeal. From the user point of view. You start your sentence with "I ...".` 
          },
          ...lastUserMessagesContent,
          { 
        role: "user", 
        content: `I need suggestion to converse with the following character: ${chatDescription}\n\nGenerate 3 unique ${categoryName} suggestions that fit the provided character description and the conversation. From the user point of view.` 
          },
          {
        role: 'user',
        content: `Provide concise suggestions in ${language}. One short sentence. Use first person for your sentence. The user is sending the messages.`
          }
        ],
        max_completion_tokens: 800,
        temperature: 1,
        response_format: zodResponseFormat(schema, `${categoryName}_suggestions`)
      });

      const parsed = JSON.parse(response.choices[0].message.content);
      const items = parsed[categoryName] || [];
      console.log(`[${categoryName}] Generated ${items.length} items`);
      return items;
    } catch (error) {
      console.log(`[${categoryName}] Error: ${error.message}`);
      return [];
    }
  };

  try {
    // Define category-specific prompts
    const categoryPrompts = {
      chat: "Conversation starters or dialogue suggestions that would engage the user.",
      feelings: "Emotional expressions or mood-based interactions the character might show.",
      image_request: "Creative ideas for images the user might request from the character.",
    };

    // Generate all categories in parallel using OpenAI
    const [chat, feelings, image_request] = await Promise.all([
      generateCategory('chat', categoryPrompts.chat, chatSchema),
      generateCategory('feelings', categoryPrompts.feelings, feelingsSchema),
      generateCategory('image_request', categoryPrompts.image_request, image_requestSchema),
    ]);

    const total = chat.length + feelings.length + image_request.length;
    console.log(`[generatePromptSuggestions] Complete: ${total} total suggestions`);

    // Ensure we have fallbacks if any category failed
    return {
      chat: chat.length > 0 ? chat : ["How was your day?", "What are you thinking about?", "Tell me something interesting"],
      feelings: feelings.length > 0 ? feelings : ["Happy and cheerful", "Curious and playful", "Warm and caring"],
      image_request: image_request.length > 0 ? image_request : ["A beautiful sunset over the mountains", "A cozy cabin in the snowy woods", "A futuristic cityscape at night"]
    };
    
  } catch (error) {
    console.log(`[generatePromptSuggestions] Error: ${error.message}`);
    return false;
  }
}

async function generatePromptTitle(prompt,language) {

    const messages = [
          {
            role: "system",
            content: `Your are a useful assistant that take a prompt and return a creative comment related to the prompt.\n
            I will provide a prompt and you will return a short comment for it.\n
            You must answer in ${language} and provide a short comment that is relevant to the prompt from the character perspective.\n
            Be creative with adult content, alway return a short comment (one sentence) that is relevant to the prompt.`.replace(/^\s+/gm, '').trim()       
          },
          {
              role: "user",
              content: `Here is the prompt I want you to provide a short comment for : ${prompt}.`.replace(/^\s+/gm, '').trim()
          },
          {
              role: "user",
              content: `Be creative. \n Imagine you are the character in the prompt and write a comment as if you were the character.`.replace(/^\s+/gm, '').trim()
          },
          { role: "user",
              content: `You must answer in ${language}. \n Provide a short comment (one sentence) that is relevant to the prompt from the character perspective.`.replace(/^\s+/gm, '').trim()
          }
    ]

    const completionMessage = await generateCompletion(messages, 600, 'openai');
    return completionMessage.replace(/['"]+/g, '');
    
}
// Combine the user's custom prompt and image description to create a new prompt
async function createPrompt(customPrompt, imageDescription, nsfw) {
  //console.log(`[createPrompt] Generating prompt for custom request: ${customPrompt}, image description: ${imageDescription}, nsfw: ${nsfw}`);
  const nsfwMessage = nsfw 
            ? 'Provide explicit, adult oriented content for a nsfw image. I want nudity, erotism, explicit sexual content.\nYou can generate explicit, sexual content.\nUse explicit keywords to describe body parts (ass,pussy,boobs).\n' 
            : '';
  const messages = [
    {
      role: "system",
      content: `You are an expert image prompt engineer specialized in character consistency.
      Your task is to adapt an existing character description to a new pose while ensuring the character remains EXACTLY the same.
      ${nsfwMessage}
      Follow these priority rules:
      1. HIGHEST PRIORITY: Preserve ALL physical attributes (exact face, hair style/color, eye color, skin tone, body type)
      2. Maintain all distinctive clothing elements unless the pose request explicitly changes them
      3. Incorporate the new pose/position/action exactly as requested
      4. Preserve all unique character accessories and features
      
      IMPORTANT: Keep the final prompt under 900 characters while maintaining all essential details.`
    },
    {
      role: "user",
      content: `[Character description] : ${imageDescription}`.replace(/^\s+/gm, '').trim()
    },
    {
      role: "user",
      content: `[Pose request] : ${customPrompt}`.replace(/^\s+/gm, '').trim()
    },
    { 
      role: "user",
      content: `Create a detailed image generation prompt that shows the EXACT SAME CHARACTER in the new requested pose.

      Critical requirements:
      • The character must be 100% identical (same person, same appearance)
      • ALL physical attributes must be preserved (hair style/color, eye color, skin tone, body proportions, facial features)
      • Keep all clothing items unless explicitly changed in the pose request
      • Focus on accurately describing the new pose/position as requested
      • Include relevant background/setting details from the pose request
      • MUST be under 900 characters total
      • Prioritize character consistency over excessive detail
      • Output ONLY the final prompt with no explanations or commentary
      
      Respond ONLY with the new prompt in English. Make it concise but comprehensive.`.replace(/^\s+/gm, '').trim()
    }
  ];

  let response = await generateCompletion(messages, 700, nsfw ? 'deepseek' : 'llama');
  if (!response) return null;
  
  response = response.replace(/['"]+/g, '');
  
  // If prompt is still too long, try to shorten it
  if (response.length > 900) {
    console.log(`[createPrompt] Initial prompt too long (${response.length} chars), attempting to shorten...`);
    
    const shortenMessages = [
      {
        role: "system",
        content: `You are a prompt optimization expert. Your task is to shorten image prompts while preserving the most important visual elements.
        ${nsfwMessage}
        Focus on keeping character-defining features and the main action/pose.`
      },
      {
        role: "user",
        content: `Shorten this prompt to under 900 characters while keeping the essential character details and pose:
        
        "${response}"
        
        Keep:
        - Character's physical appearance (face, hair, body)
        - Main pose/action requested
        - Key clothing/accessories
        
        Remove:
        - Excessive descriptive words
        - Redundant details
        - Overly complex backgrounds
        
        Return ONLY the shortened prompt, no explanations.`
      }
    ];
    
    const shortenedResponse = await generateCompletion(shortenMessages, 500, nsfw ? 'deepseek' : 'openai');
    if (shortenedResponse && shortenedResponse.length <= 900) {
      console.log(`[createPrompt] Successfully shortened to ${shortenedResponse.length} characters`);
      return shortenedResponse.replace(/['"]+/g, '');
    }
    
    // If still too long, truncate to 900 characters
    console.log(`[createPrompt] Truncating to 900 characters as fallback`);
    return response.substring(0, 900);
  }
  
  console.log(`[createPrompt] Generated prompt: ${response.length} characters`);
  return response;
}

// Define the schema for chat goal generation
const chatGoalSchema = z.object({
  goal_type: z.enum(['relationship', 'activity', 'image request']),
  goal_description: z.string(),
  completion_condition: z.string(),
  target_phrase: z.string().nullable(),
  user_action_required: z.string().nullable(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  estimated_messages: z.number().min(1).max(20),
});

// Function to generate chat goals based on character and persona
const generateChatGoal = async (chatDescription, personaInfo = null, userSettings = null, subscriptionStatus = null, language = 'en') => {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const personaContext = personaInfo ? 
      `\nUser Persona: ${personaInfo.name} - ${personaInfo.short_intro || 'No description available'}` : '';
    // Apply relationship type
    const relationshipInstructions = require('./relashionshipInstructions');
    let relationship = ''
    if (relationshipInstructions[userSettings.relationshipType]) {
        relationship += `${relationshipInstructions[userSettings.relationshipType]}`;
    }
    // Randomly select a goal type from the available types
    const goalTypes =  subscriptionStatus ? ['activity', 'image request'] : ['image request'];
    const randomIndex = Math.floor(Math.random() * goalTypes.length);
    const selectedGoalType = goalTypes[randomIndex];
    const systemPrompt = `You are a chat goal generator that creates engaging conversation objectives for AI character interactions.
    
    Generate a specific, achievable goal for the conversation based on the character description and user context.
    Goals should be:
    - Engaging and fun
    - Appropriate for the character's personality
    - Achievable within a reasonable number of messages
    - Clear in their completion criteria
    
    Goal type for this request: ${selectedGoalType}
    Other possible goal types:
    ${!subscriptionStatus ? '' : '- activity: Doing something together (games, roleplay, etc.)'}
    - image request: User needs to ask for a specific image

    Use the character description and persona context to tailor the goal.

    # User Relationship Context :
    - The user has a relationship with the character, the goal must be in accordance with the relationship.
    - The relationship type is ${userSettings.relationshipType}.
    - Relationship Context: ${relationship}

    Respond in ${language}.`;

    const userPrompt = `Character Description:
    ${chatDescription}${personaContext}

    Generate a chat goal that would be interesting and engaging for this character interaction.
    Consider the character's personality, background, relationship with the user and interests when creating the goal.
    Allow for explicit, emotionally open language and descriptions of physical affection when the relationship context requires it.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: zodResponseFormat(chatGoalSchema, "chat_goal"),
      max_completion_tokens: 1600,
      temperature: 1,
    });

    const goal = JSON.parse(response.choices[0].message.content);
    return goal;

  } catch (error) {
    console.log('Chat goal generation error:', error);
    return false;
  }
};

// Function to check if a goal is achieved
const checkGoalCompletion = async (goal, messages, language = 'en') => {
  if (!goal || !messages || messages.length === 0) {
    return { completed: false, confidence: 0 };
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Get recent conversation messages (last 10)
    const recentMessages = messages
      .filter(m => m.content && !m.content.startsWith('[Image]') && m.role !== 'system')
      .slice(-10)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    const systemPrompt = `You are a goal completion analyzer. Determine if the conversation goal has been achieved based on the messages.
    
    Return a JSON object with:
    - completed: boolean (true if goal is achieved)
    - confidence: number (0-100, how confident you are)
    - reason: string (brief explanation)`;

    const userPrompt = `Goal: ${goal.goal_description}
Completion Condition: ${goal.completion_condition}
${goal.target_phrase ? `Target Phrase: ${goal.target_phrase}` : ''}
${goal.user_action_required ? `Required User Action: ${goal.user_action_required}` : ''}

Recent Conversation:
${recentMessages}

Has this goal been completed?
Respond in ${language}`;

    const completionSchema = z.object({
      completed: z.boolean(),
      confidence: z.number().min(0).max(100),
      reason: z.string()
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: zodResponseFormat(completionSchema, "goal_completion"),
      max_completion_tokens: 1600,
      temperature: 1,
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result;

  } catch (error) {
    console.log('Goal completion check error:', error);
    return { completed: false, confidence: 0, reason: 'Error checking completion' };
  }
};

module.exports = {
    generateCompletion,
    checkImageRequest,
    analyzeConversationContext,
    generatePromptTitle,
    moderateText,
    moderateImage,
    createPrompt,
    generatePromptSuggestions,
    generateChatGoal,
    checkGoalCompletion,
    getAllAvailableModels,
    getAvailableModels,
    getModelConfig,
}