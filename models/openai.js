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
  novita_2: {
    apiUrl: 'https://api.novita.ai/v3/openai/chat/completions',
    model: 'deepseek/deepseek_v3',
    key: process.env.NOVITA_API_KEY
  },
  venice: {
    apiUrl: 'https://api.venice.ai/api/v1/chat/completions',
    model:  'llama-3.1-405b', //'dolphin-2.9.2-qwen2-72b',
    key: process.env.VENICE_API_KEY
  }
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
async function generateCompletion(messages, maxToken = 1000, model = null, lang = 'en') {
  const selectedModel = model ? apiDetails[model] : currentModel;
  const finalModel = lang === 'ja' ? apiDetails.openai : selectedModel;

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
  nude: z.enum(['false', 'top', 'bottom', 'full', 'partial', 'implied', 'bare', 'exposed', 'minimal_clothing']).optional(),
  image_focus: z.enum(['upper_body', 'full_body', 'face', 'hands', 'legs', 'torso', 'shoulders', 'arms', 'feet', 'lower_back', 'chest', 'abdomen', 'waist']).optional(),
  position: z.enum(['standing', 'sitting', 'squat', 'leaning', 'crouching', 'prone', 'supine', 'reclining', 'kneeling', 'lying_down']).optional(),
  viewpoint: z.enum(['from bottom','front', 'from behind', 'side', 'overhead', 'low_angle', 'high_angle', 'close_up', 'wide_angle', 'profile']).optional(),
  image_num: z.number(),
});

  
    
// Define the system prompt
const systemPrompt = `
    You are a helpful assistant designed to evaluate whether the user's message is related to visual content, physical content or if you cannot fulfill the request.
    Analyze the conversation for the following:
    1. **nsfw**: true if nudity (not underwear) is involved, otherwise false.
    2. **nude**: 'none', 'top', 'bottom', 'full', or 'partial', based on the level of nudity.
    3. **image_request**: true if the user's message is a request for an image, a physical request, or something you cannot do physically, otherwise false. ex: 'ちんぽ舐めて' is a physical request. 'Show me your pussy' is an image request.
    4. **image_focus**: Specify the focus area, e.g., 'upper_body', 'full_body', etc., if mentioned.
    5. **position**: Identify any pose or body positioning such as 'standing', 'sitting', or 'squat'.
    6. **viewpoint**: Capture the perspective, such as 'front', 'back', or 'side', if indicated.
    7. **image_num**: The number of images requested (minimum 1  maximum 8).
`;

const checkImageRequest = async (messages) => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // Get the last user message
    let lastUserMessagesContent = messages
    .filter((msg) =>  msg.name !== 'master' && msg.name !== 'context')
    .filter(m => m.content && !m.content.startsWith('[Image]') && m.role !== 'system' && m.role !== 'assistant')
    .slice(-2);
    // Get the last user message content as a string
    lastUserMessagesContent = lastUserMessagesContent.map((msg) => msg.content);
    lastUserMessagesContent = lastUserMessagesContent.join(',');

    if(lastUserMessagesContent.length < 1){
      return {}
    }
    
    const updatedMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Verify the following messages and check if it is about an image, showing something, a scene, something that can be shown with an image, a request, or if it is something you cannot do physically, if you cannot fulfill the request return true :${lastUserMessagesContent}` },
    ];

    let attempts = 0;
    const maxAttempts = 3;
  
    while (attempts < maxAttempts) {
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: updatedMessages,
          response_format: zodResponseFormat(formatSchema, "myResponse"),
          max_tokens: 600,
          temperature: 1,
          top_p: 0.95,
          frequency_penalty: 0.75,
          presence_penalty: 0.75,
        });
        const genImage = JSON.parse(response.choices[0].message.content);
        return genImage
      } catch (error) {
        attempts++;
        console.error(`Parsing error (Attempt ${attempts}/${maxAttempts}):`, error.message || error);
  
        if (attempts >= maxAttempts) {
          throw new Error("Failed to parse response after 3 attempts.");
        }
      }
    }
  };
  
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
    createPrompt
}