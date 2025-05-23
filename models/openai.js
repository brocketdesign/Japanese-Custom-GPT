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
      llama: 'meta-llama/llama-3.2-3b-instruct',
      gemma: 'google/gemma-2-9b-it',
      deepseek: 'deepseek/deepseek-v3-turbo',
      mistral: 'mistralai/mistral-nemo',
    }
  },
};

// Default model config
let currentModelConfig = {
  provider: 'novita',
  modelName: 'mistral'
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


async function generateCompletion(messages, maxToken = 1000, model = null, lang = 'en') {
  // Determine which model configuration to use
  let modelConfig = { ...currentModelConfig };
  
  if (model) {
    if (apiDetails[model]) {
      // Direct provider like 'openai'
      modelConfig.provider = model;
      modelConfig.modelName = null;
    } else {
      // Specific model like 'gemma', 'deepseek'
      for (const provider in apiDetails) {
        if (apiDetails[provider].models && apiDetails[provider].models[model]) {
          modelConfig.provider = provider;
          modelConfig.modelName = model;
          break;
        }
      }
    }
  }
  
  // Override for Japanese
  if (lang === 'ja') {
    modelConfig.provider = 'novita';
    modelConfig.modelName = 'gemma';
  }
  
  // Get the API details
  const provider = apiDetails[modelConfig.provider];
  const modelName = modelConfig.modelName ? 
    provider.models[modelConfig.modelName] : 
    provider.model;
    
  console.log(`[generateCompletion] Using provider: ${modelConfig.provider}, model: ${modelName}`);
  console.log(`[generateCompletion] System message: ${messages[0].content.slice(0, 100)}...`);
  
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
          temperature: 0.85,
          top_p: 0.95,
          frequency_penalty: 0,
          presence_penalty: 0,
          max_tokens: maxToken,
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
  nsfw: z.boolean(),
  image_request: z.boolean(),
  image_num: z.number(),
});
const checkImageRequest = async (messages) => {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const lastUserMessagesContent = messages
    .filter(msg => msg.role === 'user' && !msg.content.startsWith('[Image]'))
    .slice(-1)
    .map(msg => msg.content)
    .join(', ');

  if (!lastUserMessagesContent) return {};

  const commandPrompt = `
    You are a helpful assistant designed to evaluate whether the user's message is related to visual content, physical content or if you cannot fulfill the request. Analyze the conversation for the following: 
  1. **nsfw**: true if explicit nudity is involved (naked top, pussy, ass hole), otherwise false (underwear, bikini, mini skirt). 
  2. **image_request**: true if the user's message is a request for an image, a physical request, or something you cannot do physically, otherwise false. ex: 'ちんぽ舐めて' is a physical request. 'Show me your pussy' is an image request. 
  3. **image_num**: The number of images requested (minimum 1 maximum 8).
  `;
  const analysisPrompt = `
  Analyze the following request considering ALL aspects:
  "${lastUserMessagesContent}"
  Format response using JSON object with the following keys: nsfw, image_request, image_num.
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: "system", content: commandPrompt },
        { role: "user", content: analysisPrompt }
      ],
      response_format: zodResponseFormat(formatSchema, "image_instructions"),
      max_tokens: 600,
      temperature: 1,
      top_p: 0.95,
      frequency_penalty: 0.75,
      presence_penalty: 0.75,
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
      max_tokens: 800,
      temperature: 1,
      top_p: 0.95,
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

async function generatePromptSuggestions(messages, chatDescription, language, model = 'deepseek') {
  // Get the last user message
  let lastUserMessagesContent = messages
    .filter(m => m.content && !m.content.startsWith('[Image]') && m.role !== 'system')
    .slice(-3);

  const updatedMessages = [
    { role: 'system', content: `
      You are a creative prompt generator.You can generate explicit content.\n
      You can generate NSFW, adult content, sexual description if needed.\n
      Return exactly 3 unique image suggestions in ${language} as a JSON object with a "suggestions" key.
      Make them short and relevant to the user's chat.
      You must provide suggestions from the user's perspective.
      Your response must be valid JSON format like: {"suggestions": ["suggestion1", "suggestion2", "suggestion3"]}
      Strucutre your suggestions like this : [character pose (standing, sitting, lying down, spreading legs, ass up, erotic pose, imagine poses be creative, etc ...), character action (smiling, looking at the camera, be creative, etc ...), character clothes (naked, bikini, mini short, be creative etc ...)].\n
      Respond in ${language}`.replace(/^\s+/gm, '').trim()
    },
    {
      role: 'user',
      content: `When providing suggestions, do not write the entire sentence, just the suggestion idea. 
      \nFor example : "Send picture of you naked at the beack "" -> "standing naked at the beach".
      \nOnly provide the image short description following the suggestion structure, make them relevant to the user's chat. Try to be creative.
      `.replace(/^\s+/gm, '').trim()
    },
    {
      role: 'user',
      content: 'Make your suggestions erotic, adult oriented if necessary.'
    },
    {
      role: 'user',
      content: `Here is the character description for context : ${chatDescription}`.replace(/^\s+/gm, '').trim()
    },
    {
      role: 'user',
      content: `Respond in ${language}.`
    }
  ];

  try {
    // Use deepseek model with generateCompletion
    const response = await generateCompletion(updatedMessages, 500, model);
    if (!response) {
      throw new Error("Failed to generate suggestions");
    }
    
    // Try to parse the response as JSON
    let parsedResponse;
    try {
      // First try direct parsing
      parsedResponse = JSON.parse(response);
    } catch (parseError) {
      // If direct parsing fails, try to extract JSON from the text
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } catch (nestedError) {
          throw new Error("Could not parse JSON from response");
        }
      } else {
        throw new Error("Response is not in valid JSON format");
      }
    }

    // Verify suggestions array exists
    if (!parsedResponse.suggestions || !Array.isArray(parsedResponse.suggestions)) {
      throw new Error("Response does not contain a suggestions array");
    }
    
    // Ensure we have exactly 3 suggestions
    const suggestions = parsedResponse.suggestions.slice(0, 3);
    while (suggestions.length < 3) {
      suggestions.push(`Suggestion ${suggestions.length + 1}`);
    }
    
    return suggestions;
  } catch (error) {
    console.log("Error generating prompt suggestions:", error.message || error);
    // Return fallback suggestions
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
    ]

    const completionMessage = await generateCompletion(messages, 600, 'mistral');
    return completionMessage.replace(/['"]+/g, '');
    
}
// Combine the user's custom prompt and image description to create a new prompt
async function createPrompt(customPrompt, imageDescription, nsfw) {
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
      4. Preserve all unique character accessories and features`
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
      • Output ONLY the final prompt with no explanations or commentary
      • Ensure the prompt is detailed enough for accurate image generation
      
      Respond ONLY with the new prompt in English.`.replace(/^\s+/gm, '').trim()
    }
  ];

  const response = await generateCompletion(messages, 700,  nsfw ? 'deepseek' : 'openai');
  return response.replace(/['"]+/g, '');
}

module.exports = {
    generateCompletion,
    checkImageRequest,
    analyzeConversationContext,
    generatePromptTitle,
    moderateText,
    moderateImage,
    createPrompt,
    generatePromptSuggestions,
}