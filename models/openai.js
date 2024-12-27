const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { createParser } = require('eventsource-parser');
const axios = require('axios');
const { OpenAI } = require("openai");
const { z } = require("zod");
const { zodResponseFormat } = require("openai/helpers/zod");

const fetchOpenAICompletionWithTrigger = async (messages, res, maxToken = 1000, model = 'llama-3.1-405b') => { 
  try {
    const response = await fetch("https://api.venice.ai/api/v1/chat/completions", {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.VENICE_API_KEY}`
      },
      method: "POST",
      body: JSON.stringify({
        model:'llama-3.1-405b',
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

    if (!response.ok) console.error("Response body:", await response.text());

    let fullCompletion = "";
    let bracketContent = "";
    let inBracket = false;
    let triggers = [];

    const parser = createParser((event) => {
      if (event.type === 'event' && event.data !== "[DONE]") {
        const content = JSON.parse(event.data).choices[0]?.delta?.content || "";
        for (let i = 0; i < content.length; i++) {
          const char = content[i];
          if (!inBracket) {
            if (char === '[') {
              inBracket = true;
              bracketContent = "";
            } else {
              fullCompletion += char;
              res.write(`data: ${JSON.stringify({ type: 'text', content: char })}\n\n`);
            }
          } else {
            if (char === ']') {
              triggers.push(bracketContent);
              inBracket = false;
            } else {
              bracketContent += char;
            }
          }
        }
      }
    });

    for await (const chunk of response.body) {
      parser.feed(new TextDecoder('utf-8').decode(chunk));
    }

    for (const trigger of triggers) {
      if (trigger === 'image') {
        const genImage = await checkImageRequest(messages);
        console.log({genImage})
        res.write(`data: ${JSON.stringify({ type: 'trigger', name: 'image_request', command: genImage })}\n\n`);
      }
    }

    return fullCompletion;
  } catch (error) {
    console.error("Error fetching completion:", error);
    throw error;
  }
};

const _fetchOpenAICompletionWithTrigger = async (messages, res, maxToken = 1000, model = 'meta-llama/llama-3.1-70b-instruct') => {
  try {
    const response = await fetch("https://api.novita.ai/v3/openai/chat/completions", {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.NOVITA_API_KEY}`
      },
      method: "POST",
      body: JSON.stringify({
        model,
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

    if (!response.ok) console.error("Response body:", await response.text());

    let fullCompletion = "";
    let bracketContent = "";
    let inBracket = false;
    let triggers = [];

    const parser = createParser((event) => {
      if (event.type === 'event' && event.data !== "[DONE]") {
        const content = JSON.parse(event.data).choices[0].delta?.content || "";
        for (let i = 0; i < content.length; i++) {
          const char = content[i];
          if (!inBracket) {
            if (char === '[') {
              inBracket = true;
              bracketContent = "";
            } else {
              fullCompletion += char;
              res.write(`data: ${JSON.stringify({ type: 'text', content: char })}\n\n`);
            }
          } else {
            if (char === ']') {
              triggers.push(bracketContent);
              inBracket = false;
            } else {
              bracketContent += char;
            }
          }
        }
      }
    });

    for await (const chunk of response.body) {
      parser.feed(new TextDecoder('utf-8').decode(chunk));
    }

    for (const trigger of triggers) {
      if (trigger === 'image') {
        const genImage = await checkImageRequest(messages);
        console.log({genImage})
        res.write(`data: ${JSON.stringify({ type: 'trigger', name: 'image_request', command: genImage })}\n\n`);
      }
    }

    return fullCompletion;
  } catch (error) {
    console.error("Error fetching completion:", error);
    throw error;
  }
};


const fetchOpenAICompletion = async (messages, res, maxToken = 1000, model = 'meta-llama/llama-3.1-70b-instruct',genImage) => {
    try {
        let response = await fetch(
            "https://api.novita.ai/v3/openai/chat/completions",
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.NOVITA_API_KEY}`
                },
                method: "POST",
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: 0.85,
                    top_p: 0.95,
                    frequency_penalty: 0,
                    presence_penalty: 0,
                    max_tokens: maxToken,
                    stream: true,
                    n: 1,
                }),
            }
        );

        if (!response.ok) {
            console.error("Response body:", await response.text());
        }

        let fullCompletion = "";
        let triggerSent = false;

        const parser = createParser((event) => {
            if (event.type === 'event' && event.data !== "[DONE]") {
                const content = JSON.parse(event.data).choices[0].delta?.content || "";
                for (let i = 0; i < content.length; i++) {
                    const char = content[i];
                    fullCompletion += char;
                    res.write(`data: ${JSON.stringify({ type: 'text', content: char })}\n\n`);
                }
                if (genImage?.image_request && !triggerSent) {
                    res.write(`data: ${JSON.stringify({ 
                      type: 'trigger', 
                      name : 'image_request',
                      command: genImage
                    })}\n\n`);
                    triggerSent = true;
                  }                  
            }
        });
        
        for await (const chunk of response.body) {
            parser.feed(new TextDecoder('utf-8').decode(chunk));
        }

        return fullCompletion;

    } catch (error) {
        console.error("Error fetching completion:", error);
        throw error;
    }
};


async function generateCompletion(systemPrompt, userMessage, maxToken = 1000, aiModel =`meta-llama/llama-3.1-70b-instruct`) {
  console.log({systemPrompt,userMessage,aiModel})
    const response = await fetch("https://api.novita.ai/v3/openai/chat/completions", {
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.NOVITA_API_KEY}`
        },
        method: "POST",
        body: JSON.stringify({
            model: aiModel,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
            temperature: 0.85,
            top_p: 0.95,
            frequency_penalty: 0,
            presence_penalty: 0,
            max_tokens: maxToken,
            stream: false,
            n: 1,
        }),
    });
    if (!response.ok) throw new Error('Error generating completion');
    const data = await response.json();
    return data.choices[0].message.content;
}

const moduleCompletion = async (messages) => {
  const { OpenAI } = require("openai");

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await getChatResponse(messages)
  return response.choices[0].message.content

  async function getChatResponse(messages) {
    try {

      let response

      const options = {
        model:'gpt-4o-mini',
        messages,
        max_tokens: 600,
        temperature: 1,
        top_p: 0.95,
        frequency_penalty: 0.75, // Adjust if you want to penalize frequent tokens
        presence_penalty: 0.75, // Adjust if you want to penalize new tokens
        stream: false,
        n: 1,
      }

      response = await openai.chat.completions.create(options);

      return response;

    } catch (error) {
      console.error("The spell encountered an error:", error);
      throw error; // Or handle it in a more sophisticated manner
    }
  }

}

  
async function fetchNewAPICompletion(userMessages, rawReply, chatname, timeout = 30000) {
    // Convert userMessages to the required format
    const context = userMessages
    .filter(msg => msg.role !== 'system')
    .map(msg => {
        let role_type = msg.role === 'user' ? 1 : 0;
        return {
            role_type: role_type,
            text: msg.content,
            source: role_type === 1 ? 'user' : 'model'
        };
    });

    // Construct the body of the POST request
    const requestBody = {
        state: "start",
        language: "ja",
        ext_info: {
            conversation_cnt: context.length,
            language: "ja",
            bot_name: chatname
        },
        context: context,
        device: "web_desktop",
        product: "aichat",
        sys_lang: "en-US",
        country: "",
        referrer: "",
        zone: 9,
        languageV2: "ja",
        uuid: "",
        app_version: "1.5.1",
        sign: "21d079a0628298c27948aa2262c8057b"
    };

    try {
        const response = await axios.post('https://api.synclubaichat.com/aichat/h5/drainage/conversation', requestBody, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: timeout
        });
        console.log(response)
        if (response.data) {
            const content = response.data.data.text;
            console.log(content)
            // Simulate streaming by sending chunks of the content
            const chunkSize = 50; // Adjust the chunk size as needed
            for (let i = 0; i < content.length; i += chunkSize) {
                const chunk = content.slice(i, i + chunkSize);
                rawReply.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
            }
        }

    } catch (error) {
        console.error(error);
    }
}


// Define the schema for the response format
const formatSchema = z.object({
  nsfw: z.boolean(),
  image_request: z.boolean(),
  nude: z.enum(['false', 'top', 'bottom', 'full', 'partial', 'implied', 'bare', 'exposed', 'minimal_clothing']).optional(),
  image_focus: z.enum(['upper_body', 'full_body', 'face', 'hands', 'legs', 'torso', 'shoulders', 'arms', 'feet', 'lower_back', 'chest', 'abdomen', 'waist']).optional(),
  position: z.enum(['standing', 'sitting', 'squat', 'leaning', 'crouching', 'prone', 'supine', 'reclining', 'kneeling', 'lying_down']).optional(),
  viewpoint: z.enum(['from bottom','front', 'from behind', 'side', 'overhead', 'low_angle', 'high_angle', 'close_up', 'wide_angle', 'profile']).optional()
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
`;

const checkImageRequest = async (messages) => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // Get the last user messages
    const lastTwoMessages = messages
    .filter((msg) =>  msg.name !== 'master' && msg.name !== 'context')
    .slice(-2);
    
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

        return JSON.parse(response.choices[0].message.content);
      } catch (error) {
        attempts++;
        console.error(`Parsing error (Attempt ${attempts}/${maxAttempts}):`, error.message || error);
  
        if (attempts >= maxAttempts) {
          throw new Error("Failed to parse response after 3 attempts.");
        }
      }
    }
  };
  

// Zod schema to ensure the response format is correct
const characterDescriptionSchema = z.object({
  age: z.string(),
  skin_color: z.string(),
  hair_color: z.string(),
  hair_length: z.string(),
  eyes_color: z.string(),
  tone: z.string(), // tone of skin, mood, etc.
  face_expression: z.string(),
  body_type: z.string(),
  body_characteristic: z.string(),
  breast_size: z.string(),
  ass_size: z.string(),
  facial_features: z.string()
});


const system = `
You are a highly detailed image analysis assistant. You will receive an image as input in Base64 format. 
Your job is to describe the principal physical properties of the character in the image as a JSON object. 

Focus on the following properties for the character:
- age (approximate age range or impression, if not possible ,teen, young, mature, old)
- skin_color
- hair_color
- hair_length
- eyes_color
- tone (overall vibe, e.g., "soft", "intense", "delicate")
- face_expression (e.g. "smiling", "serious", "neutral")
- body_type (e.g. "slim", "athletic", "curvy", "voluptuous")
- body_characteristic (any distinctive body marks or features)
- breast_size (slim,medium,large,massive)
- ass_size (small,medium,large,massive)
- facial_features (notable facial features)

Please return your final answer strictly as a JSON object matching the schema without any comment, start with the bracket {. 
If some attributes are unclear or not visible, make your best guess.
`;

async function describeCharacterFromImage(base64Image) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let messages = [
    { role: "system", content: system },
    { 
      role: "user", 
      content: JSON.stringify([{
        "type": "image_url",
        "image_url": { "url": base64Image }
      }])
    }
  ];

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 1000,
        temperature: 1,
        top_p: 0.95,
        frequency_penalty: 0.75,
        presence_penalty: 0.75
      });

      // Validate and parse the response
      return JSON.parse(response.choices[0].message.content);

    } catch (error) {
      attempts++;
      console.error(`Parsing error (Attempt ${attempts}/${maxAttempts}):`, error.message || error);

      if (attempts >= maxAttempts) {
        throw new Error("Failed to parse response after 3 attempts.");
      }
    }
  }
}


  module.exports = {
    fetchOpenAICompletion,moduleCompletion,generateCompletion, fetchOpenAICompletionWithTrigger,
    fetchNewAPICompletion,
    checkImageRequest,
    describeCharacterFromImage
}