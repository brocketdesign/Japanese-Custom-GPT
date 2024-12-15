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
                      command: !genImage.nude ? 'image_sfw' : (genImage.nsfw ? 'image_nsfw' : 'image_sfw') 
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
const fetchOpenAINarration = async (messages, res, maxToken = 1000, language) => {
    try {
        // Prepare the prompt specifically for generating narration
        const narrationPrompt = [
            { 
                role: "system", 
                content: `You are a commentator.
                YOU DO NOT WRITE THE CHARACTER ANSWER.
                You respond in ${language}.` 
            },
            { 
                role: "user", 
                content: `I will provide a conversation, comment on the expression of the character who is about to answer.
                    Your response is short, clear and in ${language}. You provide ONLY a short comment.
                    Use the conversation transcript provided below:
                ` + messages.map(msg => msg.role != 'system' ? `${msg.content.replace('[Narrator]','')}`: '').join("\n") 
            }
        ];
        let response = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
                },
                method: "POST",
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: narrationPrompt, // Use the narration prompt
                    temperature: 0.75,
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
            throw new Error("Failed to fetch narration completion");
        }

        let fullNarration = "";
        const parser = createParser((event) => {
            try {
                if (event.type === 'event') {
                    if (event.data !== "[DONE]") {
                        const content = JSON.parse(event.data).choices[0].delta?.content || "";
                        fullNarration += content;
                        res.write(`data: ${JSON.stringify({ content: `${content}` })}\n\n`);
                    }
                }
            } catch (error) {
                console.log(error);
                console.error("Error in parser:", error);
                console.error("Event causing error:", event);
            }
        });

        for await (const chunk of response.body) {
            parser.feed(new TextDecoder('utf-8').decode(chunk));
        }

        return fullNarration;

    } catch (error) {
        console.error("Error fetching OpenAI narration:", error);
        throw error;
    }
};

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

// Define the schema for the response format
const formatSchema = z.object({
    nsfw: z.boolean(),
    image_request: z.boolean(),
    nude: z.boolean()
  });
  
  const checkImageRequest = async (messages) => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
    // Define the system prompt
    const systemPrompt = `
      Analyze the conversation to determine:
      1. If the content involves NSFW (Not Safe For Work) topics, specifically nudity (not including underwear), return 'nsfw: true'. Otherwise, 'nsfw: false'.
      2. If underwear or bikini or fishnet (sexy outfit) is involved instead of full nudity, return 'nude: false'. Otherwise, 'nude: true'.
      3. If the user is requesting or discussing image generation, return 'image_request: true' or 'image_request: false'.
      Ensure the response is structured as:
      { "nsfw": boolean, "image_request": boolean, "nude": boolean }
    `;
  
    const updatedMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];
  
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
  };
  
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

// Function to fetch custom OpenAI response
const fetchOpenAICustomResponse = async (customPrompt, messages, res, maxToken = 1000) => {
    try {
        const fullPrompt = [
            { role: "system", content: customPrompt.systemContent },
            { role: "user", content: customPrompt.userContent + messages.map(msg => msg.role != 'system' ? `${msg.content}` : '').join("\n") }
        ];

        let response = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
                },
                method: "POST",
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: fullPrompt,
                    temperature: customPrompt.temperature || 0.75,
                    top_p: customPrompt.top_p || 0.95,
                    frequency_penalty: customPrompt.frequency_penalty || 0,
                    presence_penalty: customPrompt.presence_penalty || 0,
                    max_tokens: maxToken,
                    stream: true,
                    n: 1,
                }),
            }
        );

        if (!response.ok) {
            console.error("Response body:", await response.text());
            throw new Error("Failed to fetch custom OpenAI response");
        }

        let fullResponse = "";
        const parser = createParser((event) => {
            try {
                if (event.type === 'event') {
                    if (event.data !== "[DONE]") {
                        const content = JSON.parse(event.data).choices[0].delta?.content || "";
                        fullResponse += content;
                        res.write(`data: ${JSON.stringify({ content: `${content}` })}\n\n`);
                    }
                }
            } catch (error) {
                console.log(error);
                console.error("Error in parser:", error);
                console.error("Event causing error:", event);
            }
        });

        for await (const chunk of response.body) {
            parser.feed(new TextDecoder('utf-8').decode(chunk));
        }

        return fullResponse;

    } catch (error) {
        console.error("Error fetching custom OpenAI response:", error);
        throw error;
    }
};


  module.exports = {
    fetchOpenAICompletion,moduleCompletion,generateCompletion,fetchOpenAINarration, 
    fetchNewAPICompletion, fetchOpenAICustomResponse,
    checkImageRequest
}