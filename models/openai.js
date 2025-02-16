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
    model: 'sao10k/l3-8b-lunaris',
    key: process.env.NOVITA_API_KEY
  },
};

let currentModel = apiDetails.novita; // Change this to switch models

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
  const selectedModel = model ? apiDetails[model] : currentModel;
  const finalModel = lang === 'ja' ? apiDetails.novita : selectedModel;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(finalModel.apiUrl, {
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${finalModel.key}`
        },
        method: "POST",
        body: JSON.stringify({
            model: finalModel.model,
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

      if (!response.ok) {
        if (attempt === 2) {
          const errorData = await response.json().catch(() => ({}));
          console.log(`Failed after ${attempt} attempts:`, errorData.error?.message || '');
          return false;
        }
        continue; // Try second attempt
      }

      const data = await response.json();
      const filter = data.choices[0]?.content_filter_results;
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

  const suggestionSchema = z.object({
    suggestions: z.array(z.string())
  });
async function generatePromptSuggestions(messages,chatDescription,language) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Get the last user message
  let lastUserMessagesContent = messages
  .filter((msg) =>  msg.name !== 'master' && msg.name !== 'context')
  .filter(m => m.content && !m.content.startsWith('[Image]') && m.role !== 'system')
  .slice(-3);

  const updatedMessages = [
    { role: 'system', content: `
      You are a creative assistant.
      Return exactly 3 unique suggestions in ${language} as a JSON object with a "suggestions" key.
      Your suggestions must include:
      1. An erotic image suggestion relevant to the user's chat and the character description.
      2. An erotic chat suggestion to make the conversation more engaging.
      3. An interaction improvement suggestion to enhance the user's experience.
      Make them short and relevant to the user's chat.
      You must provide suggestions from the user's perspective and suitable for a chat.
      Example: ["send an image of you smiling", "what did you do today", "let's play together"].
      Respond in ${language}`.replace(/^\s+/gm, '').trim()
    },
    {
      role: 'assistant',
      content: 'To help you provide more accurate suggestions, here is the character description: ' + chatDescription
    },
    ...lastUserMessagesContent,
  ];

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: updatedMessages,
      response_format: zodResponseFormat(suggestionSchema, "suggestionResponse"),
      max_tokens: 150,
      temperature: 0.8
    });
    return JSON.parse(response.choices[0].message.content).suggestions;

  } catch (error) {
    console.log("Error generating prompt suggestions:", error.message || error);
    return error;
  }
}

  async function generatePromptTitle(prompt,language) {
    const messages = [
          {
            role: "system",
            content: `Your are a useful assistant that take a prompt and return a comment related to the prompt.\n
            I will provide a prompt and you will return a short descriptive comment for it.\n
            You must answer in ${language} and provide a comment that is relevant to the prompt, and suitable to social media, include the prompt keywords for SEO purposes.\n
            Be creative with adult content, alway return a short comment (one sentence) that is relevant to the prompt.`.replace(/^\s+/gm, '').trim()       
          },
          {
              role: "user",
              content: `Here is the prompt I want you to provide a descriptive comment for : ${prompt}.`.replace(/^\s+/gm, '').trim()
          },
          {
              role: "user",
              content: `I have lots of images, I need a short comment that help me find the image.\n 
              Try to describe using keywords.\n 
              Write the comment at the first person as if you were the character in the picture.`.replace(/^\s+/gm, '').trim()
          },
    ]

    const completionMessage = await generateCompletion(messages, 600, 'openai')
    return completionMessage.replace(/['"]+/g, '');
    
}
// Combine the user's custom prompt and image description to create a new prompt
async function createPrompt(customPrompt, imageDescription, nsfw) {
  const nsfwMessage = nsfw 
            ? 'Provide explicit, adult oriented content for a nsfw image. I want nudity, erotism, explicit sexual content.\n' 
            : '';
  const messages = [
    {
      role: "system",
      content: `
      You help me update my character prompt to match the user image request.\n
      You must provide the desired answer.\n${nsfwMessage}
      I will provide an image request that you will use to update my prompt.\n
      You can generate explicit, sexual content.\n
      Use explicit keywords to describe body parts (ass,pussy,boobs), clothes.\n
      You must follow the image request as it is the main focus of the new prompt but keep the character main characteristic to avoid generating a different character.\n`
    },
    {
      role: "user",
      content: `Here is the prompt I want you to update : ${imageDescription}\n`.replace(/^\s+/gm, '').trim()
    },
    {
      role: "user",
      content: `Here is the image request : ${customPrompt}`.replace(/^\s+/gm, '').trim()
    },
    { 
      role:"user",
      content: `You must adapt the prompt to the image request but keep the character traits. \n
      Remove unrelevant keywords and adapt to the image request.\n 
      You must include the character's skin color, hair color, and eye color in the new prompt. Keep the same clothes if not asked otherwise. \n
      You must answer in English with the new prompt. Do not include anything else in the response.`.replace(/^\s+/gm, '').trim()
    }
  ];

  const response = await generateCompletion(messages, 600);
  return response.replace(/['"]+/g, '');
}

module.exports = {
    generateCompletion,
    checkImageRequest,
    generatePromptTitle,
    moderateText,
    moderateImage,
    createPrompt,
    generatePromptSuggestions
}