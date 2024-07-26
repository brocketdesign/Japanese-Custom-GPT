const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { createParser } = require('eventsource-parser');

const fetchOpenAICompletion = async (messages, res, maxToken = 1000) => {
    try {
        let response = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
                },
                method: "POST",
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages,
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

        console.log("Response status:", response.status);
        console.log("Response status text:", response.statusText);

        if (!response.ok) {
            console.error("Response body:", await response.text());
        }

        let fullCompletion = "";
        let chunkIndex = 0;
        const parser = createParser((event) => {
            try {
                if (event.type === 'event') {
                    if (event.data !== "[DONE]") {
                        const content = JSON.parse(event.data).choices[0].delta?.content || "";
                        fullCompletion += content;
                        res.write(`data: ${JSON.stringify({ content })}\n\n`);
                        //res.flush();
                        chunkIndex++;
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

        return fullCompletion;

    } catch (error) {
        console.error("Error fetching OpenAI completion:", error);
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
        model:'gpt-4o',
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


  module.exports = {fetchOpenAICompletion,moduleCompletion}