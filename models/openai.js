const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { createParser } = require('eventsource-parser');
const axios = require('axios');
const { OpenAI } = require("openai");
const { z } = require("zod");
const { zodResponseFormat } = require("openai/helpers/zod");

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
    nude: z.boolean(),
    nude_type: z.enum(['none', 'top', 'bottom', 'full']).optional(),
    image_focus: z.enum(['upper_body', 'full_body']).optional(),
    position: z.enum(['standing', 'sitting', 'squat']).optional(),
    viewpoint: z.enum(['front', 'back', 'side']).optional()
  });
  
    
// Define the system prompt
const systemPrompt = `
    Analyze the conversation:
    1. nsfw: true if nudity (not underwear) is involved, else false.
    2. nude: true if full nude requested, else false.
    3. image_request: true if user last message is a request for image from the user, else false.
    4. nude_type: 'none','top','bottom','full' if applicable.
    5. image_focus: 'upper_body' or 'full_body'.
    6. position: 'standing','sitting','squat' if specified.
    7. viewpoint: 'front','back','side' if specified.
    
    Return:
    {
    "nsfw": boolean,
    "image_request": boolean,
    "nude": boolean,
    "nude_type": "none|top|bottom|full",
    "image_focus": "upper_body|full_body",
    "position": "standing|sitting|squat",
    "viewpoint": "front|back|side"
    }
`;
const checkImageRequest = async (messages) => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const updatedMessages = [
      { role: "system", content: systemPrompt },
      ...messages
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
    fetchOpenAICompletion,moduleCompletion,generateCompletion, 
    fetchNewAPICompletion,
    checkImageRequest,describeCharacterFromImage
}