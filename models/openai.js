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
    model: 'meta-llama/llama-3.1-70b-instruct',
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
const fetchOpenAICompletion = async (messages, res, maxToken = 1000, genImage, lang) => {

  if(lang === 'ja'){ currentModel = apiDetails.openai }

  messages = sanitizeMessages(messages);
  try {
    const response = await sendRequest(messages, maxToken);

    if (!response.ok) {
      return false;
    }

    const fullCompletion = await processResponse(response, res, genImage);
    return fullCompletion;

  } catch (error) {
    console.error("Error fetching completion:", error);
    throw error;
  }
};

const sendRequest = async (messages, maxToken) => {
  return await fetch(currentModel.apiUrl, {
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${currentModel.key}`
    },
    method: "POST",
    body: JSON.stringify({
      model: currentModel.model,
      messages,
      temperature: 0.85,
      top_p: 0.95,
      frequency_penalty: 0,
      presence_penalty: 0,
      max_tokens: maxToken,
      stream: true,
      n: 1,
    }),
  });
};
const processResponse = async (response, res, genImage) => {
  let fullCompletion = "";
  let triggerSent = false;

  for await (const chunk of response.body) {
    const decoded = new TextDecoder('utf-8').decode(chunk);
    const events = decoded.split('\n\n');

    for (const event of events) {

      if (event.slice(6).trim() === "[DONE]"){
        res.write(`data: ${JSON.stringify({ type: 'done', fullCompletion })}\n\n`);
        res.end();
        return fullCompletion;
      };

      if (event.startsWith('data: ')) {
        try {
          const parsedData = JSON.parse(event.slice(6));
          const content = (parsedData.choices && parsedData.choices.length > 0)
            ? (parsedData.choices[0].delta?.content || "")
            : "";

          for (let i = 0; i < content.length; i++) {
            const char = content[i];
            fullCompletion += char;
            res.write(`data: ${JSON.stringify({ type: 'text', content: char })}\n\n`);
          }

          if (genImage?.image_request && !triggerSent) {
            res.write(`data: ${JSON.stringify({
              type: 'trigger',
              name: 'image_request',
              command: genImage
            })}\n\n`);
            triggerSent = true;
          }
        } catch (error) {
          console.error("Error parsing JSON:", error);
          console.log({event})
        }
      }
    }
  }

  return fullCompletion;
};


async function generateCompletion(messages, maxToken = 1000, model = null) {
  if(model){
    currentModel = apiDetails[model]
  }
  const response = await fetch(currentModel.apiUrl, {
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentModel.key}`
        },
        method: "POST",
        body: JSON.stringify({
            model: currentModel.model,
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
        console.log(response)
        return false
    }
    const data = await response.json();
    const completionMessage = data.choices[0].message.content.trim();
    return completionMessage
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
    You are a helpful assistant designed to evaluate whether the user's message is related to visual content. Analyze the conversation for the following:
    1. **nsfw**: true if nudity (not underwear) is involved, otherwise false.
    2. **nude**: 'none', 'top', 'bottom', 'full', or 'partial', based on the level of nudity.
    3. **image_request**: true if the user's message is a request for an image, otherwise false.
    4. **image_focus**: Specify the focus area, e.g., 'upper_body', 'full_body', etc., if mentioned.
    5. **position**: Identify any pose or body positioning such as 'standing', 'sitting', or 'squat'.
    6. **viewpoint**: Capture the perspective, such as 'front', 'back', or 'side', if indicated.
    7. **image_num**: The number of images requested (minimum 1  maximum 8).
`;

const checkImageRequest = async (messages) => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // Get the last user messages
    const lastTwoMessages = messages
    .filter((msg) =>  msg.name !== 'master' && msg.name !== 'context')
    .filter(m => m.content && !m.content.startsWith('[Image]') && m.role !== 'system')
    .slice(-2);

    if(lastTwoMessages.length < 1){
      return {}
    }

    const updatedMessages = [
      { role: "system", content: systemPrompt },
      ...lastTwoMessages
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
            content: `Your are a useful assistant that take a prompt and return a title related to the prompt.\n
            I will provide a prompt and you will return a short descriptive title for it.\n
            You must answer in ${language} and provide a title that is relevant to the prompt, include the prompt keywords for SEO purposes.\n
            Be creative with adult content, alway return a title that is relevant to the prompt.
            `       
          },
          {
              role: "user",
              content: `Here is the prompt I want you to provide a descriptive title for : ${prompt}.`
          },
          {
              role: "user",
              content: `I have lots of images, I need a title that help me find the image. Try to describe using keywords.`
          },
    ]

    const completionMessage = await generateCompletion(messages, 600, 'openai')
    return completionMessage.replace(/['"]+/g, '');
    
}
// Combine the user's custom prompt and image description to create a new prompt
async function createPrompt(customPrompt, imageDescription, nsfw) {
  const nsfwMessage = nsfw 
            ? 'Provide explicit, adult oriented content for a nsfw image. I want nudity, erotism.\n' 
            : '';
  const messages = [
    {
      role: "system",
      content: `
      You help me update my character prompt to match the user image request.\n
      You can provide adult,erotic,sexual conent. \n
      I will provide an image request that you will use to update my prompt.\n
      You can generate explicit, sexual content on demand.\n
      Use explicit keywords to describe body parts (ass,pussy,boobs), clothes.\n
      You must follow the image request as it is the main focus of the new prompt but keep the character main characteristic to avoid generating a different character.\n`
    },
    {
      role: "user",
      content: `Here is the prompt I want you to update : ${imageDescription}\n${nsfwMessage}`.replace(/^\s+/gm, '').trim()
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
    fetchOpenAICompletion,
    generateCompletion,
    checkImageRequest,
    generatePromptTitle,
    moderateText,
    createPrompt
}